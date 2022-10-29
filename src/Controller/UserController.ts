import { User } from '../Schema/UserSchema';
import { Media } from '../Schema/MediaSchema';
import { Post } from '../Schema/PostSchema';
import { Subscription } from '../Schema/SubscriptionSchema';
import { Comment } from '../Schema/CommentSchema';

import ServerException from '../Exception/ServerException';
import DTOValidator from '../Middlewares/DTOValidator';
import Routable from '../Interface/Routable';

import { hash, genSalt, compare } from 'bcrypt';
import { randomBytes } from 'crypto';
import { existsSync, unlinkSync } from 'fs';
import { sendNotification } from 'web-push';
import { Router, Response, Request } from 'express';
import { Save, Login, Follow, Edit } from '../DTO/UserDTO';
import multer, { diskStorage } from 'multer';

export default class UserController implements Routable
{
    route: string;
    router: Router;
    constructor()
    {
        this.router = Router();
        this.route = '/user';
    }

    initialiseRouter()
    {
        const upload = multer({
            storage: diskStorage({
                destination: (request, file, callback) => {
                    callback(null, './public/uploads/');
                },
                filename: (request, file, callback) => {
                    callback(null, `${Date.now()}_${file.originalname}`);
                }
            })
        });

        this.router.post('/save', DTOValidator(Save), this.save);
        this.router.post('/login', DTOValidator(Login), this.login);
        this.router.post('/follow', DTOValidator(Follow), this.follow);
        this.router.post('/unfollow', DTOValidator(Follow), this.unfollow);
        this.router.get('/fingerprint', this.fingerprint);
        this.router.get('/getCurrentUser', this.getCurrentUser);
        this.router.get('/getWebProfile/:username', this.getWebProfile);
        this.router.put('/edit', upload.single('media'), DTOValidator(Edit), this.edit);
        this.router.delete('/delete', this.delete);
    }

    getCookie(name: string, cookies: string[])
    {
        name = `${name}=`;
        for (let i = 0; i < cookies.length; i++) {
            let cookie = cookies[i];
            while (cookie.charAt(0) == ' ') {
                cookie = cookie.substring(1);
            }
            if (cookie.indexOf(name) == 0) {
                return cookie.substring(name.length, cookie.length);
            }
        }
        return (null);
    }

    fingerprint = async (request: Request, response: Response) =>
    {
        try {

            if (request.session.user){
                if (!await User.exists({_id: request.session.user.id})){
                    delete (request.session.user);
                    const fingerprint = randomBytes(20).toString('hex');
                    response.cookie('fingerprint', fingerprint);
                    request.session.visitor = { 'fingerprint': fingerprint };
                } else if (!this.getCookie('fingerprint', request.headers.cookie.split(';'))){
                    const fingerprint = randomBytes(20).toString('hex');
                    response.cookie('fingerprint', fingerprint);
                    request.session.user.fingerprint = fingerprint;
                }
            } else if (request.session.visitor){
                if (!this.getCookie('fingerprint', request.headers.cookie.split(';'))){
                    const fingerprint = randomBytes(20).toString('hex');
                    response.cookie('fingerprint', fingerprint);
                    request.session.visitor.fingerprint = fingerprint;
                }
            } else {
                const fingerprint = randomBytes(20).toString('hex');
                response.cookie('fingerprint', fingerprint);
                request.session.visitor = { 'fingerprint': fingerprint };
            }

            response
            .status(204)
            .send();

        } catch(error){

            response
            .status(error instanceof ServerException ? error.httpCode : 500)
            .send({
                errors: error instanceof ServerException ? error.messages : ['Internal server error']
            });
        }
    }

    save = async (request: Request, response: Response) =>
    {
        try {

            const data = request.body;

            if (await User.exists({
                $or: [
                    { email: new RegExp(`^${data.email}$`, 'i') },
                    { username: new RegExp(`^${data.username}$`, 'i') }
                ]
            })){
                throw(new ServerException(['Email or username already taken'], 200));
            }

            data.password = await hash(
                data.password,
                await genSalt(parseInt(process.env.BCRYPT_SALT_ROUNDS))
            );
            
            const newUser = new User(data);

            if (!await newUser.save()){
                throw(new Error('Failed to save User'));
            }

            response
            .status(204)
            .send();

        } catch(error){

            response
            .status(error instanceof ServerException ? error.httpCode : 500)
            .send({
                errors: error instanceof ServerException ? error.messages : ['Internal server error']
            });
        }
    }

    edit = async (request: Request, response: Response) =>
    {
        try {

            if (!request.session?.user?.id){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const data = request.body;
            if (data.username === undefined && data.description === undefined && request.file === undefined){
                throw(new ServerException(['you must include one of the following parameters: username, description, media'], 400));
            }

            const user = await User.findById(request.session.user.id).populate('media');
            if (!user){
                throw(new ServerException(['Unauthorized'], 401));
            }

            if (request.file){

                if (!existsSync(request.file.path)){
                    throw(new Error(`Failed to upload file of type ${request.file.mimetype}`));
                }

                const newMedia = new Media({
                    user: user._id,
                    mimetype: request.file.mimetype,
                    filename: request.file.filename,
                    originalName: request.file.originalname,
                    location: request.file.path,
                    url: `${process.env.SERVER_URL}/media/${request.file.filename}`,
                    size: request.file.size
                });

                if (!await newMedia.save()){
                    throw(new Error('Failed to save Media'));
                }

                //@ts-ignore
                data.media = newMedia._id;

                if (user.media){

                    if (existsSync(user.media.location)){
                        unlinkSync(user.media.location);
                    }

                    if (!await Media.deleteOne({_id: user.media._id})){
                        throw(new Error(`Failed to deleteOne Media with _id ${user.media._id}`));
                    }
                }
            }

            if (!await User.updateOne({_id: request.session.user.id}, {$set: data})){
                throw(new Error(`Failed to updateOne User with _id ${request.session.user.id}`));
            }

            response
            .status(204)
            .send();

        } catch(error){

            if (request.file && existsSync(request.file.path)){
                unlinkSync(request.file.path);
            }

            response
            .status(error instanceof ServerException ? error.httpCode : 500)
            .send({
                errors: error instanceof ServerException ? error.messages : ['Internal server error']
            });
        }
    }

    delete = async (request: Request, response: Response) =>
    {
        try {

            if (!request.session?.user?.id){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const user = await User.findById(
                request.session.user.id,
                { _id: 1, following: 1, likes: 1 }
            );

            if (!user){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const medias = await Media.find(
                { user: user._id },
                { location: 1 }
            );

            if (medias?.length){
                for (const media of medias){
                    if (existsSync(media.location)){
                        unlinkSync(media.location);
                    }
                }
            }

            if (!await Post.deleteMany({user: user._id})){
                throw(new Error(`Failed to deleteMany Post of User with _id ${user._id}`));
            }

            if (!await Post.updateMany({_id: user.likes}, {$pull: {likes: user._id}})){
                throw(new Error(`Failed to deleteMany Post of User with _id ${user._id}`));
            }

            if (!await Media.deleteMany({user: user._id})){
                throw(new Error(`Failed to deleteMany Media of User with _id ${user._id}`));
            }

            if (!await Subscription.deleteMany({user: user._id})){
                throw(new Error(`Failed to deleteMany Subscription of User with _id ${user._id}`));
            }

            if (!await Comment.deleteMany({user: user._id})){
                throw(new Error(`Failed to deleteMany Comment of User with _id ${user._id}`));
            }

            if (!await User.updateMany({_id: user.following}, {$pull: {followers: user._id}})){
                throw(new Error(`Failed to updateMany User with _ids ${user.following.join()}`));
            }

            if (!await User.updateOne({_id: user._id}, {$set: {deletedAt: new Date}})){
                throw(new Error(`Failed to updateOne User with _id ${user._id}`));
            }

            response
            .status(204)
            .send();

        } catch(error){

            response
            .status(error instanceof ServerException ? error.httpCode : 500)
            .send({
                errors: error instanceof ServerException ? error.messages : ['Internal server error']
            });
        }
    }

    login = async (request: Request, response: Response) =>
    {
        try {

            const data = request.body;
            const user = await User.findOne({
                $or: [
                    { email: data.identifier },
                    { username: data.identifier }
                ]
            });

            if (!user){
                throw(new ServerException(['Incorrect username or email'], 200));
            }

            if (!await compare(data.password, user.password)){
                throw(new ServerException(['Incorrect username or email'], 200));
            }

            const fingerprint = randomBytes(20).toString('hex');
            response.cookie('fingerprint', fingerprint);

            delete (request.session.visitor);
            request.session.user = {
                id: user._id,
                fingerprint: fingerprint
            };

            response
            .status(200)
            .send({
                user: {
                    username: user.username,
                    email: user.email
                }
            });

        } catch(error){

            response
            .status(error instanceof ServerException ? error.httpCode : 500)
            .send({
                errors: error instanceof ServerException ? error.messages : ['Internal server error']
            });
        }
    }

    getWebProfile = async (request: Request, response: Response) =>
    {
        try {

            if (!request.session?.user?.id){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const webProfile = await User.aggregate([
                {$match: {
                    username: { $regex: new RegExp(`\\b${request.params.username}\\b`, 'i') }
                }},
                {$lookup: {
                    from: 'posts',
                    let: {'userId': '$_id'},
                    pipeline: [
                        {$match: {
                            $expr: {
                                $eq: ['$user', '$$userId']
                            }
                        }},
                        {$lookup: {
                            from: 'medias',
                            let: {'mediaId': '$media'},
                            pipeline: [
                                {$match: {
                                    $expr: {
                                        $eq: ['$_id', '$$mediaId']
                                    }
                                }},
                                {$project: {
                                    _id: 1,
                                    mimetype: 1,
                                    url: 1
                                }}
                            ],
                            as: 'media'
                        }},
                        {
                            $unwind: {
                                path : '$media',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {$lookup: {
                            from: 'comments',
                            let: {'postId': '$_id'},
                            pipeline: [
                                {$match: {
                                    $expr: {
                                        $eq: ['$post', '$$postId']
                                    }
                                }},
                                {$lookup: {
                                    from: 'users',
                                    let: {'userId': '$user'},
                                    pipeline: [
                                        {$match: {
                                            $expr: {
                                                $eq: ['$_id', '$$userId']
                                            }
                                        }},
                                        {$lookup: {
                                            from: 'medias',
                                            let: {'mediaId': '$media'},
                                            pipeline: [
                                                {$match: {
                                                    $expr: {
                                                        $eq: ['$_id', '$$mediaId']
                                                    }
                                                }},
                                                {$project: {
                                                    mimetype: 1,
                                                    url: 1
                                                }}
                                            ],
                                            as: 'media'
                                        }},
                                        {
                                            $unwind: {
                                                path : '$media',
                                                preserveNullAndEmptyArrays: true
                                            }
                                        },
                                        {$project: {
                                            _id: 1,
                                            username: 1,
                                            media: {
                                                $ifNull: ['$media', null]
                                            }
                                        }}
                                    ],
                                    as: 'user'
                                }},
                                {
                                    $unwind: {
                                        path : '$user',
                                        preserveNullAndEmptyArrays: true
                                    }
                                },
                                {$sort: {
                                    createdAt : -1
                                }},
                                {$project: {
                                    _id : 1,
                                    user: 1,
                                    text: 1,
                                    createdAt: 1,
                                    updatedAt: 1
                                }}
                            ],
                            as: 'comments'
                        }},
                        {$addFields: { 
                            isLiked: { 
                                $cond: [ 
                                    { $in: [ request.session.user.id, '$likes' ] },
                                    true, 
                                    false
                                ]
                            }
                        }},
                        {$project: {
                            _id: 1,
                            description: 1,
                            comments: 1,
                            media: {
                                $ifNull: ['$media', null]
                            },
                            createdAt: 1,
                            likes: {
                                $size: '$likes'
                            },
                            isLiked: 1
                        }},
                    ],
                    as: 'posts'
                }},
                {$lookup: {
                    from: 'medias',
                    let: {'mediaId': '$media'},
                    pipeline: [
                        {$match: {
                            $expr: {
                                $eq: ['$_id', '$$mediaId']
                            }
                        }},
                        {$project: {
                            _id : 0,
                            mimetype: 1,
                            url: 1
                        }}
                    ],
                    as: 'media'
                }},
                {
                    $unwind: {
                        path : '$media',
                        preserveNullAndEmptyArrays: true,
                    }
                },
                {$addFields: { 
                    isFollower: { 
                        $cond: [ 
                            { $in: [ request.session.user.id, '$followers' ] },
                            true, 
                            false
                        ]
                    }
                }},
                {$project: {
                    _id: 1,
                    username: 1,
                    description: 1,
                    followers: {
                        $size: '$followers'
                    },
                    following: {
                        $size: '$following'
                    },
                    media: {
                        $ifNull: ['$media', null]
                    },
                    isFollower: 1,
                    posts: 1,
                    createdAt: 1
                }}
            ]);

            if (!webProfile?.length){
                throw(new ServerException([`user ${request.params.username} does not exist`], 400));
            }

            response
            .status(200)
            .send({
                webProfile: webProfile[0]
            });

        } catch(error){

            response
            .status(error instanceof ServerException ? error.httpCode : 500)
            .send({
                errors: error instanceof ServerException ? error.messages : ['Internal server error']
            });
        }
    }

    getCurrentUser = async (request: Request, response: Response) =>
    {
        try {

            if (!request.session?.user?.id){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const user = await User.aggregate([
                {$match: {
                    _id: request.session.user.id,
                }},
                {$lookup: {
                    from: 'medias',
                    let: {'mediaId': '$media'},
                    pipeline: [
                        {$match: {
                            $expr: {
                                $eq: ['$_id', '$$mediaId']
                            }
                        }},
                        {$project: {
                            _id : 0,
                            mimetype: 1,
                            url: 1
                        }}
                    ],
                    as: 'media'
                }},
                {
                    $unwind: {
                        path : '$media',
                        preserveNullAndEmptyArrays: true,
                    }
                },
                {$project: {
                    _id: 1,
                    username: 1,
                    description: 1,
                    media: {
                        $ifNull: ['$media', null]
                    },
                    createdAt: 1
                }}
            ]);

            response
            .status(200)
            .send({
                user: user?.length ? user[0] : null
            })

        } catch(error){

            response
            .status(error instanceof ServerException ? error.httpCode : 500)
            .send({
                errors: error instanceof ServerException ? error.messages : ['Internal server error']
            })
        }
    }

    follow = async (request: Request, response: Response) =>
    {
        try {

            if (!request.session?.user?.id){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const user = await User.findById(
                request.session.user.id,
                { _id: 1, username: 1 }
            );

            if (!user){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const data = request.body;

            if (user._id.equals(data.userId)){
                throw(new ServerException(['Prohibited'], 403));
            }

            const targetedUser = await User.findById(
                data.userId,
                { _id: 1, followers: 1 }
            )

            if (!targetedUser){
                throw(new ServerException([`user ${data.userId} does not exist`], 400));
            }

            if (!targetedUser.followers.includes(user._id)){

                if (!await User.updateOne({_id: data.userId}, {$addToSet: {followers: user._id}})){
                    throw(new Error(`Failed to updateOne User with _id ${data.userId}`));
                }
    
                if (!await User.updateOne({_id: user._id}, {$addToSet: {following: targetedUser._id}})){
                    throw(new Error(`Failed to updateOne User with _id ${user._id}`));
                }
    
                const subscriptions = await Subscription.find(
                    { user: targetedUser._id },
                    { _id: 0, endpoint: 1, 'keys.auth': 1, 'keys.p256dh': 1 }
                );
    
                if (subscriptions?.length){
                    for (const subscription of subscriptions){
                        sendNotification(subscription, JSON.stringify({
                            type: 'NEW_FOLLOWER',
                            message: `${user.username} is now following you`,
                            url: `${process.env.FRONT_URL}/user/${user._id}`
                        }));
                    }
                }
            }

            response
            .status(204)
            .send();

        } catch(error){

            response
            .status(error instanceof ServerException ? error.httpCode : 500)
            .send({
                errors: error instanceof ServerException ? error.messages : ['Internal server error']
            });
        }
    }

    unfollow = async (request: Request, response: Response) =>
    {
        try {

            if (!request.session?.user?.id){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const data = request.body;

            if (!await User.exists({_id: data.userId})){
                throw(new ServerException([`user ${data.userId} does not exist`], 400));
            }

            if (!await User.updateOne({_id: data.userId}, {$pull: {followers: request.session.user.id}})){
                throw(new Error(`Failed to updateOne User with _id ${data.userId}`));
            }

            if (!await User.updateOne({_id: request.session.user.id}, {$pull: {following: data.userId}})){
                throw(new Error(`Failed to updateOne User with _id ${request.session.user.id}`));
            }

            response
            .status(204)
            .send();

        } catch(error){

            response
            .status(error instanceof ServerException ? error.httpCode : 500)
            .send({
                errors: error instanceof ServerException ? error.messages : ['Internal server error']
            });
        }
    }
}