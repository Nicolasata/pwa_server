import Post from '../Schema/PostSchema';
import Comment from '../Schema/CommentSchema';
import Subscription from '../Schema/SubscriptionSchema';
import User from '../Schema/UserSchema';

import ServerException from '../Exception/ServerException';
import Routable from '../Interface/Routable';
import DTOValidator from '../Class/DTOValidator';

import { plainToInstance } from 'class-transformer';
import { sendNotification } from 'web-push';

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

            const user = await User.findById(
                request.session.user.id,
                { _id: 1, username: 1 }
            );

            if (!user){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const data = plainToInstance(SaveDTO, request.body);
            const errors = await super.validateDTO(data);

            if (errors?.length){
                throw(new ServerException(errors, 400));
            }

            const post = await Post.findById(
                data.post,
                { _id: 1, user: 1 }
            );

            if (!post){
                throw(new ServerException([`post ${data.post} does not exist`], 400));
            }

            const newComment = new Comment({
                user: user._id,
                ...data
            });

            if (!await newComment.save()){
                throw(new Error('Failed to save Comment'));
            }

            const subscriptions = await Subscription.find(
                { user: post.user },
                { _id: 0, endpoint: 1, 'keys.auth': 1, 'keys.p256dh': 1 }
            );

            if (subscriptions?.length){
                for (const subscription of subscriptions){
                    sendNotification(subscription, JSON.stringify({
                        type: 'NEW_COMMENT',
                        message: `${user.username} commented on one of your posts`,
                        url: `${process.env.FRONT_URL}/post/${post._id}`
                    }));
                }
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