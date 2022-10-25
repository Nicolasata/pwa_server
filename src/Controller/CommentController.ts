import Post from '../Schema/PostSchema';
import Comment from '../Schema/CommentSchema';

import ServerException from '../Exception/ServerException';
import Routable from '../Interface/Routable';
import DTOValidator from '../Class/DTOValidator';

import { plainToInstance } from 'class-transformer';

import SaveDTO from '../DTO/Comment/Save';
import EditDTO from '../DTO/Comment/Edit';

import * as express from 'express';

export default class CommentController extends DTOValidator implements Routable
{
    route: string;
    router: express.Router;
    constructor()
    {
        super();
        this.router = express.Router();
        this.route = '/comment';
    }

    initialiseRouter()
    {
        this.router.post('/save', this.save);
        this.router.put('/edit/:commentId', this.edit);
        this.router.delete('/delete/:commentId', this.delete);
    }

    save = async (request: express.Request, response: express.Response) =>
    {
        try {

            if (!request.session?.user?.id){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const data = plainToInstance(SaveDTO, request.body);
            const errors = await super.validateDTO(data);

            if (errors?.length){
                throw(new ServerException(errors, 400));
            }

            if (!await Post.exists({_id: data.post})){
                throw(new ServerException([`post ${data.post} does not exist`], 400));
            }

            const newComment = new Comment({
                user: request.session.user.id,
                ...data
            });

            if (!await newComment.save()){
                throw(new Error('Failed to save Comment'));
            }

            response
            .status(200)
            .send(newComment);

        } catch(error){

            response
            .status(error instanceof ServerException ? error.httpCode : 500)
            .send({
                errors: error instanceof ServerException ? error.messages : ['Internal server error']
            });
        }
    }

    edit = async (request: express.Request, response: express.Response) =>
    {
        try {

            if (!request.session?.user?.id){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const data = plainToInstance(EditDTO, request.body);
            const errors = await super.validateDTO(data);

            if (errors?.length){
                throw(new ServerException(errors, 400));
            }

            const comment = await Comment.findById(request.params.commentId);

            if (!comment){
                throw(new ServerException([`comment ${request.params.commentId} does not exist`], 400));
            }

            if (!comment.user.equals(request.session.user.id)){
                throw(new ServerException(['Prohibited'], 403));
            }

            if (!await Comment.updateOne({_id: comment._id}, {$set: data})){
                throw(new Error(`Failed to updateOne Comment with _id ${comment._id}`));
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

    delete = async (request: express.Request, response: express.Response) =>
    {
        try {

            if (!request.session?.user?.id){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const comment = await Comment.findById(request.params.commentId);

            if (!comment){
                throw(new ServerException([`comment ${request.params.commentId} does not exist`], 400));
            }

            if (!comment.user.equals(request.session.user.id)){
                throw(new ServerException(['Prohibited'], 403));
            }

            if (!await Comment.deleteOne({_id: comment._id})){
                throw(new Error(`Failed to deleteOne Comment with _id ${comment._id}`));
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