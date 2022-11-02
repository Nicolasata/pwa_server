import { Post } from '../Schema/PostSchema';
import { User } from '../Schema/UserSchema';
import { Media } from '../Schema/MediaSchema';
import { Subscription } from '../Schema/SubscriptionSchema';

import ServerException from '../Exception/ServerException';
import Routable from '../Interface/Routable';
import DTOValidator from '../Middlewares/DTOValidator';
import IsAuthenticated from '../Middlewares/IsAuthenticated';

import { Types } from 'mongoose';
import { sendNotification } from 'web-push';
import { Save, Edit } from '../DTO/PostDTO';
import { Router, Response, Request } from 'express';
import { existsSync, unlinkSync } from 'fs';

export default class PostController implements Routable
{
    route: string;
    router: Router;
    constructor()
    {
        this.router = Router();
        this.route = '/post';
    }

    initialiseRouter()
    {
        this.router.post('/save', IsAuthenticated, DTOValidator(Save), this.save);
        this.router.put('/edit/:postId', IsAuthenticated, DTOValidator(Edit), this.edit);
        this.router.put('/like/:postId', IsAuthenticated, this.like);
        this.router.get('/getPosts', IsAuthenticated, this.getPosts);
        this.router.get('/getPost/:postId', IsAuthenticated, this.getPost);
        this.router.delete('/delete/:postId', IsAuthenticated, this.delete);
    }

    save = async (request: Request, response: Response) =>
    {
        try {

            const user = await User.findById(request.session.user.id, {
                _id: 1, username: 1, followers: 1
            });

            if (!user){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const data = request.body;
            const media = await Media.findById(data.media, {
                _id: 1, path: 1, url: 1, mimetype: 1
            });

            if (!media) {
                throw new ServerException([`Media with _id ${request.params.mediaId} does not exists`], 400);
            }
    
            if (!existsSync(media.path)){
                throw new ServerException([`Media with _id ${request.params.mediaId} does not exists`], 400);
            }

            const newPost = new Post({
                user: user._id,
                media: media._id,
                ...data
            });

            if (!await newPost.save()){
                throw(new Error('Failed to save Post'));
            }

            const subscriptions = await Subscription.find(
                { user: user.followers },
                { _id: 0, endpoint: 1, 'keys.auth': 1, 'keys.p256dh': 1 }
            );

            if (subscriptions?.length){
                for (const subscription of subscriptions){
                    sendNotification(subscription, JSON.stringify({
                        type: 'NEW_POST',
                        message: `${user.username} has published a new post`,
                        url: `${process.env.FRONT_URL}/post/${newPost._id}`
                    }));
                }
            }

            response
            .status(200)
            .send({
                _id: newPost._id,
                media: {
                    url: media.url,
                    mimetype: media.mimetype
                },
                likes: 0,
                description: newPost.description
            });

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

    getPosts = async (request: Request, response: Response) =>
    {
        try {

            const user = await User.findById(request.session.user.id, {
                _id: 1
            });

            if (!user) {
                throw(new ServerException(['Unauthorized'], 401));
            }

            const posts = await Post.aggregate([
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
                                    { $in: [ user._id, '$followers' ] },
                                    true, 
                                    false
                                ]
                            }
                        }},
                        {$project: {
                            _id: 1,
                            username: 1,
                            media: {
                                $ifNull: ['$media', null]
                            },
                            followers: {
                                $size: '$followers'
                            },
                            following: {
                                $size: '$following'
                            },
                            isFollower: 1
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
                    isLiked: { 
                        $cond: [ 
                            { $in: [ user._id, '$likes' ] },
                            true, 
                            false
                        ]
                    }
                }},
                {$sort: {
                    createdAt : -1
                }},
                {$project: {
                    _id: 1,
                    description: 1,
                    user: 1,
                    comments: 1,
                    media: {
                        $ifNull: ['$media', null]
                    },
                    likes: {
                        $size: '$likes'
                    },
                    isLiked: 1
                }}
            ]);

            response
            .status(200)
            .send({
                posts: posts
            });

        } catch(error){

            response
            .status(error instanceof ServerException ? error.httpCode : 500)
            .send({
                errors: error instanceof ServerException ? error.messages : ['Internal server error']
            })
        }
    }

    getPost = async (request: Request, response: Response) =>
    {
        try {

            const user = await User.findById(request.session.user.id, {
                _id: 1
            });

            if (!user) {
                throw(new ServerException(['Unauthorized'], 401));
            }

            const post = await Post.aggregate([
                {$match: {
                    _id: new Types.ObjectId(request.params.postId)
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
                                    { $in: [ user._id, '$followers' ] },
                                    true, 
                                    false
                                ]
                            }
                        }},
                        {$project: {
                            _id: 1,
                            username: 1,
                            media: {
                                $ifNull: ['$media', null]
                            },
                            followers: {
                                $size: '$followers'
                            },
                            following: {
                                $size: '$following'
                            },
                            isFollower: 1
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
                    isLiked: { 
                        $cond: [ 
                            { $in: [ user._id, '$likes' ] },
                            true, 
                            false
                        ]
                    }
                }},
                {$project: {
                    _id: 1,
                    description: 1,
                    user: 1,
                    comments: 1,
                    likes: {
                        $size: '$likes'
                    },
                    media: {
                        $ifNull: ['$media', null]
                    },
                    createdAt: 1,
                    isLiked: 1
                }}
            ]);

            if (!post?.length){
                throw(new ServerException([`post ${request.params.postId} does not exist`], 400));
            }

            response
            .status(200)
            .send({
                post: post[0]
            });

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

            const user = await User.findById(request.session.user.id, {
                _id: 1
            });

            if (!user) {
                throw(new ServerException(['Unauthorized'], 401));
            }

            const post = await Post.findById(request.params.postId);

            if (!post){
                throw(new ServerException([`post ${request.params.postId} does not exist`], 400));
            }

            if (!post.user._id.equals(user._id)){
                throw(new ServerException(['Prohibited'], 403));
            }

            const data = request.body;
            if (!await Post.updateOne({_id: post._id}, {$set: data})){
                throw(new Error(`Failed to updateOne Post with _id ${post._id}`));
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

    like = async (request: Request, response: Response) =>
    {
        try {

            const user = await User.findById(request.session.user.id, {
                _id: 1, username: 1
            });

            if (!user){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const post = await Post.findById(request.params.postId);

            if (!post){
                throw(new ServerException([`post ${request.params.postId} does not exist`], 400));
            }

            if (!post.likes.includes(user._id)){

                if (!await Post.updateOne({ _id: post._id }, { $push: {likes: user._id} })){
                    throw(new Error(`Failed to updateOne Post with _id ${post._id}`));
                }
                
                if (!await User.updateOne({ _id: user._id }, { $push: {likes: post._id} })){
                    throw(new Error(`Failed to updateOne User with _id ${user._id}`));
                }

                const subscriptions = await Subscription.find(
                    { user: post.user },
                    { _id: 0, endpoint: 1, 'keys.auth': 1, 'keys.p256dh': 1 }
                );

                if (subscriptions?.length){
                    for (const subscription of subscriptions){
                        sendNotification(subscription, JSON.stringify({
                            type: 'NEW_LIKE',
                            message: `${user.username} liked one of your posts`,
                            url: `${process.env.FRONT_URL}/post/${post._id}`
                        }));
                    }
                }

            } else {

                if (!await Post.updateOne({ _id: post._id} , { $pull: {likes: user._id} })){
                    throw(new Error(`Failed to updateOne Post with _id ${post._id}`));
                }

                if (!await User.updateOne({ _id: user._id }, { $pull: {likes: post._id} })){
                    throw(new Error(`Failed to updateOne User with _id ${user._id}`));
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

    delete = async (request: Request, response: Response) =>
    {
        try {

            const post = await Post.findById(request.params.postId).populate('media');

            if (!post){
                throw(new ServerException([`post ${request.params.postId} does not exist`], 400));
            }

            if (!post.user._id.equals(request.session.user.id)){
                throw(new ServerException(['Prohibited'], 403));
            }

            if (post.media){

                if (!await Media.deleteOne({_id: post.media._id})){
                    throw(new Error(`Failed to deleteOne Media with _id ${post.media._id}`));
                }
    
                if (existsSync(post.media.path)){
                    unlinkSync(post.media.path);
                }
            }

            if (!await Post.deleteOne({_id: post._id})){
                throw(new Error(`Failed to deleteOne Post with _id ${post._id}`));
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