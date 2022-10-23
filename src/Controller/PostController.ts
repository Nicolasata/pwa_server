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
        this.router.post('/save', upload.single('media'), this.save);
        this.router.put('/edit/:postId', this.edit);
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
                for (const [constraint, message] of Object.entries(error.constraints)) {
                    messages.push(message);
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
                title: data.title,
                description: data.description
            });

            if (!await newPost.save()){
                throw(new Error('Failed to save Post'));
            }

            //TODO: NOTIFY THE SUBSCRIBERS

            response.status(200).send({
                _id: newPost._id,
                media: {
                    url: newMedia.url,
                    mimetype: newMedia.mimetype
                },
                title: newPost.title,
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

            const posts = await Post.aggregate([
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
                    title: 1,
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

    edit = async (request: express.Request, response: express.Response) =>
    {
        try {

            if (!request.session?.user?.id){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const data = request.body;
            if (data.title === undefined && data.description === undefined){
                throw(new ServerException(['you must include one of the following parameters: title, description'], 400));
            }

            if (!await Post.exists({_id: request.params.postId})){
                throw(new ServerException([`post ${request.params.postId} does not exist`], 400));
            }

            const errors = await this.validateDTO(EditDTO, data);

            if (errors?.length){
                throw(new ServerException(errors, 400));
            }

            if (!await Post.updateOne({_id: request.params.postId}, {$set: data})){
                throw(new Error(`Failed to updateOne Post with _id ${request.params.postId}`));
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