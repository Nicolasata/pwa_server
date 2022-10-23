import Routable from '../Interface/Routable';
import User from '../Schema/UserSchema';
import Media from '../Schema/MediaSchema';
import Post from '../Schema/PostSchema';
import Subscription from '../Schema/SubscriptionSchema';
import ServerException from '../Exception/ServerException';
import { hash, genSalt, compare } from 'bcrypt';
import { randomBytes } from 'crypto';
import { validate } from 'class-validator';
import { ClassConstructor, plainToClass } from 'class-transformer';
import { existsSync, unlinkSync } from 'fs';
import { Types } from 'mongoose';

import SaveDTO from '../DTO/User/Save';
import LoginDTO from '../DTO/User/Login';
import SubscribeDTO from '../DTO/User/Subscribe';
import EditDTO from '../DTO/User/Edit';

import * as express from 'express';
import * as multer from 'multer';

export default class UserController implements Routable
{
    route: string;
    router: express.Router;
    constructor()
    {
        this.router = express.Router();
        this.route = '/user';
    }

    initialiseRouter()
    {
        const diskStorage = multer.diskStorage({
            destination: (request, file, callback) => {
                callback(null, './public/uploads/');
            },
            filename: (request, file, callback) => {
                callback(null, `${Date.now()}_${file.originalname}`);
            }
        });

        const upload = multer({
            storage: diskStorage
        });

        this.router.post('/save', this.save);
        this.router.post('/login', this.login);
        this.router.post('/subscribe', this.subscribe);
        this.router.post('/unsubscribe', this.unsubscribe);
        this.router.get('/fingerprint', this.fingerprint);
        this.router.get('/getCurrentUser', this.getCurrentUser);
        this.router.get('/getByUsername/:username', this.getByUsername);
        this.router.put('/edit', upload.single('media'), this.edit);
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

    async validateDTO<T extends ClassConstructor<any>>(DTO: T, data: Object): Promise<string[]>
    {
        const test = plainToClass(DTO, data);
        const errors = await validate(test, {
            skipMissingProperties: false,
            stopAtFirstError: true
        });
        const messages = [];
        if (errors?.length){
            for (const error of errors){
                for (const [constraint, message] of Object.entries(error.constraints)) {
                    messages.push(message);
                }
            }
        }
        return (messages);
    }

    fingerprint = async (request: express.Request, response: express.Response) =>
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

            response.status(204).send();

        } catch(error){

            response
            .status(error instanceof ServerException ? error.httpCode : 500)
            .send({
                errors: error instanceof ServerException ? error.messages : ['Internal server error']
            })
        }
    }

    save = async (request: express.Request, response: express.Response) =>
    {
        try {

            const data = request.body;
            const errors = await this.validateDTO(SaveDTO, data);

            if (errors?.length){
                throw(new ServerException(errors, 400));
            }

            if (await User.exists({
                $or: [
                    { email: new RegExp(`^${data.email}$`, 'i') },
                    { username: new RegExp(`^${data.username}$`, 'i') }
                ]
            })){
                throw(new ServerException(['Email or username already taken'], 200));
            }
            
            const newUser = new User({
                username: data.username,
                email: data.email,
                password: await hash(data.password, await genSalt(parseInt(process.env.BCRYPT_SALT_ROUNDS)))
            });

            if (!await newUser.save()){
                throw(new Error('Failed to save User'));
            }

            response.status(204).send();

        } catch(error){

            response
            .status(error instanceof ServerException ? error.httpCode : 500)
            .send({
                errors: error instanceof ServerException ? error.messages : ['Internal server error']
            })
        }
    }

    edit = async (request: express.Request, response: express.Response) =>
    {
        try {

            if (!request.session?.user?.id){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const data = request.body;
            if (data.username === undefined && data.description === undefined && request.file === undefined){
                throw(new ServerException(['you must include one of the following parameters: username, description, media'], 400));
            }

            const errors = await this.validateDTO(EditDTO, data);

            if (errors?.length){
                throw(new ServerException(errors, 400));
            }

            const user = await User.findById(request.session.user.id).populate('avatar');

            if (!user){
                throw(new Error(`user ${request.session.user.id} does not exist`));
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

                data.avatar = newMedia._id;

                if (user.avatar){

                    //@ts-ignore
                    if (existsSync(user.avatar.location)){
                        //@ts-ignore
                        unlinkSync(user.avatar.location);
                    }

                    if (!await Media.deleteOne({_id: user.avatar._id})){
                        throw(new Error(`Failed to deleteOne Media with _id ${user.avatar._id}`));
                    }
                }
            }

            if (!await User.updateOne({_id: request.session.user.id}, {$set: data})){
                throw(new Error(`Failed to updateOne Post with _id ${request.session.user.id}`));
            }

            response.status(204).send()

        } catch(error){

            if (request.file && existsSync(request.file.path)){
                unlinkSync(request.file.path);
            }

            response
            .status(error instanceof ServerException ? error.httpCode : 500)
            .send({
                errors: error instanceof ServerException ? error.messages : ['Internal server error']
            })
        }
    }

    delete = async (request: express.Request, response: express.Response) =>
    {
        try {

            if (!request.session?.user?.id){
                throw(new ServerException(['Unauthorized'], 401));
            }

            let user = await User.aggregate([
                {$match: {
                    _id: new Types.ObjectId(request.session.user.id)
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
                                    location: 1
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
                            media: {
                                $ifNull: ['$media', null]
                            }
                        }}
                    ],
                    as: 'posts'
                }},
                {$lookup: {
                    from: 'subscriptions',
                    let: {'userId': '$_id'},
                    pipeline: [
                        {$match: {
                            $expr: {
                                $eq: ['$user', '$$userId']
                            }
                        }},
                        {$project: {
                            _id : 1
                        }}
                    ],
                    as: 'subscriptions'
                }},
                {$lookup: {
                    from: 'medias',
                    let: {'mediaId': '$avatar'},
                    pipeline: [
                        {$match: {
                            $expr: {
                                $eq: ['$_id', '$$mediaId']
                            }
                        }},
                        {$project: {
                            _id : 1,
                            location: 1
                        }}
                    ],
                    as: 'avatar'
                }},
                {
                    $unwind: {
                        path : '$avatar',
                        preserveNullAndEmptyArrays: true,
                    }
                },
                {$project: {
                    _id: 1,
                    avatar: {
                        $ifNull: ['$avatar', null]
                    },
                    posts: 1,
                    subscriptions: 1
                }}
            ]);

            if (user?.length){

                user = user[0];

                const postIds = [];
                const mediaIds = [];
                const subscriptionIds = [];

                //@ts-ignore
                if (user.avatar){

                    //@ts-ignore
                    if (existsSync(user.avatar.location)){
                        //@ts-ignore
                        unlinkSync(user.avatar.location);
                    }
                    //@ts-ignore
                    mediaIds.push(user.avatar._id);
                }

                //@ts-ignore
                for (const subscription of user.subscriptions){
                    subscriptionIds.push(subscription._id);
                }

                //@ts-ignore
                for (const post of user.posts){

                    //@ts-ignore
                    if (existsSync(post.media.location)){
                        //@ts-ignore
                        unlinkSync(post.media.location);
                    }

                    postIds.push(post._id);
                    mediaIds.push(post.media._id);
                }

                if (postIds.length){
                    if (!await Post.deleteMany({_id: postIds})){
                        throw(new Error(`Failed to deleteMany Post with _ids ${postIds.join()}`));
                    }
                }

                if (mediaIds.length){
                    if (!await Media.deleteMany({_id: mediaIds})){
                        throw(new Error(`Failed to deleteMany Media with _ids ${mediaIds.join()}`));
                    }
                }

                if (subscriptionIds.length){
                    if (!await Subscription.deleteMany({_id: subscriptionIds})){
                        throw(new Error(`Failed to deleteMany Subscription with _ids ${subscriptionIds.join()}`));
                    }
                }

                if (!await User.updateOne({_id: request.session.user.id}, {$set: {deletedAt: new Date}})){
                    throw(new Error(`Failed to updateOne User with _id ${request.session.user.id}`));
                }
            }

            response.status(204).send();

        } catch(error){

            response
            .status(error instanceof ServerException ? error.httpCode : 500)
            .send({
                errors: error instanceof ServerException ? error.messages : ['Internal server error']
            })
        }
    }

    login = async (request: express.Request, response: express.Response) =>
    {
        try {

            const data = request.body;
            const errors = await this.validateDTO(LoginDTO, data);

            if (errors?.length){
                throw(new ServerException(errors, 400));
            }

            const user = await User.findOne({
                $or: [
                    { email: data.identifier },
                    { username: data.identifier }
                ]
            });

            if (!user){
                throw(new ServerException(['Incorrect username or email'], 200));
            }

            if (!user.verified){
                throw(new ServerException(['Unverified account'], 200));
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
            })

        } catch(error){

            response
            .status(error instanceof ServerException ? error.httpCode : 500)
            .send({
                errors: error instanceof ServerException ? error.messages : ['Internal server error']
            })
        }
    }

    getByUsername = async (request: express.Request, response: express.Response) =>
    {
        try {

            const user = await User.aggregate([
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
                        {$project: {
                            _id: 1,
                            title: 1,
                            description: 1,
                            media: {
                                $ifNull: ['$media', null]
                            },
                            createdAt: 1
                        }}
                    ],
                    as: 'posts'
                }},
                {$lookup: {
                    from: 'medias',
                    let: {'mediaId': '$avatar'},
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
                    as: 'avatar'
                }},
                {
                    $unwind: {
                        path : '$avatar',
                        preserveNullAndEmptyArrays: true,
                    }
                },
                {$project: {
                    _id: 1,
                    username: 1,
                    description: 1,
                    avatar: {
                        $ifNull: ['$avatar', null]
                    },
                    posts: 1,
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

    getCurrentUser = async (request: express.Request, response: express.Response) =>
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
                    let: {'mediaId': '$avatar'},
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
                    as: 'avatar'
                }},
                {
                    $unwind: {
                        path : '$avatar',
                        preserveNullAndEmptyArrays: true,
                    }
                },
                {$project: {
                    _id: 1,
                    username: 1,
                    description: 1,
                    avatar: {
                        $ifNull: ['$avatar', null]
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

    subscribe = async (request: express.Request, response: express.Response) =>
    {
        try {

            if (!request.session?.user?.id){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const data = request.body;
            const errors = await this.validateDTO(SubscribeDTO, data);

            if (errors?.length){
                throw(new ServerException(errors, 400));
            }

            if (!await User.exists({_id: data.userId})){
                throw(new ServerException([`user ${data.userId} does not exist`], 400));
            }

            if (!await User.updateOne({_id: data.userId}, {$push: {subscribers: request.session.user.id}})){
                throw(new Error(`Failed to updateOne User with _id ${data.userId}`));
            }

            //TODO: NOTIFY THE USER WHO HAS BEEN FOLLOWED

            response.status(204).send()

        } catch(error){

            response
            .status(error instanceof ServerException ? error.httpCode : 500)
            .send({
                errors: error instanceof ServerException ? error.messages : ['Internal server error']
            })
        }
    }

    unsubscribe = async (request: express.Request, response: express.Response) =>
    {
        try {

            if (!request.session?.user?.id){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const data = request.body;
            const errors = await this.validateDTO(SubscribeDTO, data);

            if (errors?.length){
                throw(new ServerException(errors, 400));
            }

            if (!await User.exists({_id: data.userId})){
                throw(new ServerException([`user ${data.userId} does not exist`], 400));
            }

            if (!await User.updateOne({_id: data.userId}, {$pull: {subscribers: request.session.user.id}})){
                throw(new Error(`Failed to updateOne User with _id ${data.userId}`));
            }

            response.status(204).send()

        } catch(error){

            response
            .status(error instanceof ServerException ? error.httpCode : 500)
            .send({
                errors: error instanceof ServerException ? error.messages : ['Internal server error']
            })
        }
    }
}