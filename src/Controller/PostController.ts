import Routable from '../Interface/Routable';
import Post from '../Schema/PostSchema';
import Media from '../Schema/MediaSchema';
import ServerException from '../Exception/ServerException';
import { validate } from 'class-validator';
import { ClassConstructor, plainToClass } from 'class-transformer';
import { existsSync, unlinkSync } from 'fs';
import { Types } from 'mongoose';

import SaveDTO from '../DTO/Post/Save';
import EditDTO from '../DTO/Post/Edit';
import LikeDTO from '../DTO/Post/Like';

import * as express from 'express';
import * as multer from 'multer';

export default class UserController implements Routable
{
    route: string;
    router: express.Router;
    constructor()
    {
        this.router = express.Router();
        this.route = '/post';
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

        this.router.get('/getPosts/:userId', this.getPosts);
        this.router.get('/getPost/:postId', this.getPost);
        this.router.post('/save', upload.single('media'), this.save);
        this.router.put('/edit/:postId', this.edit);
        this.router.put('/like/:postId', this.like);
        this.router.delete('/delete/:postId', this.delete);
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
                if (error.constraints){
                    for (const [constraint, message] of Object.entries(error.constraints)) {
                        messages.push(message);
                    }
                }
                if (error.children){
                    for (const children of error.children){
                        for (const [constraint, message] of Object.entries(children.constraints)) {
                            messages.push(message);
                        }
                    }
                }
            }
        }
        return (messages);
    }

    save = async (request: express.Request, response: express.Response) =>
    {
        try {

            if (!request.session?.user?.id){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const data = request.body;
            const errors = await this.validateDTO(SaveDTO, data);

            if (errors?.length){
                throw(new ServerException(errors, 400));
            }

            if (!request.file){
                throw(new ServerException(['media should not be undefined'], 400));
            }

            if (!existsSync(request.file.path)){
                throw(new Error(`Failed to upload file of type ${request.file.mimetype}`));
            }

            const newMedia = new Media({
                user: request.session.user.id,
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

            const newPost = new Post({
                user: request.session.user.id,
                media: newMedia._id,
                description: data.description
            });

            if (!await newPost.save()){
                throw(new Error('Failed to save Post'));
            }

            //TODO: NOTIFY THE FOLLOWERS

            response.status(200).send({
                _id: newPost._id,
                media: {
                    url: newMedia.url,
                    mimetype: newMedia.mimetype
                },
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
            })
        }
    }

    getPosts = async (request: express.Request, response: express.Response) =>
    {
        try {

            let posts = await Post.aggregate([
                {$match: {
                    user: new Types.ObjectId(request.params.userId)
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
                    media: {
                        $ifNull: ['$media', null]
                    },
                    likes: 1
                }}
            ]);

            if (request.session?.user?.id){
                //@ts-ignore
                posts = posts.map((post) =>{
                    //@ts-ignore
                    post.liked = post.likes.findIndex((like: any) => like.equals(request.session.user.id)) !== -1
                    return (post);
                });
            }

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

    getPost = async (request: express.Request, response: express.Response) =>
    {
        try {

            let post = await Post.aggregate([
                {$match: {
                    _id: new Types.ObjectId(request.params.postId)
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
                    description: 1,
                    likes: 1,
                    media: {
                        $ifNull: ['$media', null]
                    },
                    createdAt: 1
                }}
            ]);

            if (!post?.length){
                throw(new ServerException([`post ${request.params.postId} does not exist`], 400));
            }

            post = post[0];

            if (request.session?.user?.id){
                //@ts-ignore
                post.liked = post.likes.findIndex((like: any) => like.equals(request.session.user.id)) !== -1
            }

            response
            .status(200)
            .send({
                post: post
            });

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
            if (data.description === undefined){
                throw(new ServerException(['you must include one of the following parameters: description'], 400));
            }

            const post = await Post.findById(request.params.postId);

            if (!post){
                throw(new ServerException([`post ${request.params.postId} does not exist`], 400));
            }

            if (!post.user.equals(request.session.user.id)){
                throw(new ServerException(['Prohibited'], 403));
            }

            const errors = await this.validateDTO(EditDTO, data);

            if (errors?.length){
                throw(new ServerException(errors, 400));
            }

            if (!await Post.updateOne({_id: post._id}, {$set: data})){
                throw(new Error(`Failed to updateOne Post with _id ${post._id}`));
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

    like = async (request: express.Request, response: express.Response) =>
    {
        try {

            if (!request.session?.user?.id){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const post = await Post.findById(request.params.postId);

            if (!post){
                throw(new ServerException([`post ${request.params.postId} does not exist`], 400));
            }

            const data = request.body;
            const errors = await this.validateDTO(LikeDTO, data);

            if (errors?.length){
                throw(new ServerException(errors, 400));
            }

            const like = post.likes.includes(new Types.ObjectId(request.session.user.id));

            if (data.like && !like){
                if (!await Post.updateOne({_id: post._id}, {$push: {likes: request.session.user.id}})){
                    throw(new Error(`Failed to updateOne Post with _id ${post._id}`));
                }
            } else if (!data.like && like){
                if (!await Post.updateOne({_id: post._id}, {$pull: {likes: request.session.user.id}})){
                    throw(new Error(`Failed to updateOne Post with _id ${post._id}`));
                }
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

    delete = async (request: express.Request, response: express.Response) =>
    {
        try {

            if (!request.session?.user?.id){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const post = await Post.findById(request.params.postId).populate('media');

            if (!post){
                throw(new ServerException([`post ${request.params.postId} does not exist`], 400));
            }

            if (!post.user.equals(request.session.user.id)){
                throw(new ServerException(['Prohibited'], 403));
            }

            if (!await Media.deleteOne({_id: post.media})){
                throw(new Error(`Failed to deleteOne Media with _id ${post.media}`));
            }

            //@ts-ignore
            if (existsSync(post.media.location)){
                //@ts-ignore
                unlinkSync(post.media.location);
            }

            if (!await Post.deleteOne({_id: post._id})){
                throw(new Error(`Failed to deleteOne Post with _id ${post._id}`));
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