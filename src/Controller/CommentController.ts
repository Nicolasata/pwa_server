import { Post } from '../Schema/PostSchema';
import { Comment } from '../Schema/CommentSchema';
import { Subscription } from '../Schema/SubscriptionSchema';
import { User } from '../Schema/UserSchema';

import ServerException from '../Exception/ServerException';
import Routable from '../Interface/Routable';
import DTOValidator from '../Middlewares/DTOValidator';
import IsAuthenticated from '../Middlewares/IsAuthenticated';

import { Save, Edit } from '../DTO/CommentDTO';
import { Router, Response, Request } from 'express';

import * as webPush from 'web-push';
import NotificationType from '../Enum/notificationType';

export default class CommentController implements Routable
{
    route: string;
    router: Router;
    constructor()
    {
        this.router = Router();
        this.route = '/comment';
    }

    initialiseRouter()
    {
        this.router.post('/save', IsAuthenticated, DTOValidator(Save), this.save);
        this.router.put('/edit/:commentId', IsAuthenticated, DTOValidator(Edit), this.edit);
        this.router.delete('/delete/:commentId', IsAuthenticated, this.delete);
    }

    save = async (request: Request, response: Response) =>
    {
        try {

            const user = await User.findById(request.session.user.id, {
                _id: 1, username: 1, media: 1
            }).populate('media', { url: 1, mimetype: 1 });

            if (!user){
                throw(new ServerException(['Non autorisé'], 401));
            }

            const data = request.body;
            const post = await Post.findById(data.post, {
                _id: 1, user: 1
            });

            if (!post){
                throw(new ServerException([`post ${data.post} n'existe pas`], 400));
            }

            const newComment = new Comment({
                user: user._id,
                ...data
            });

            if (!await newComment.save()){
                throw(new Error('Failed to save Comment'));
            }

            if (!user._id.equals(post.user)){

                const subscriptions = await Subscription.find(
                    { user: post.user },
                    { _id: 1, endpoint: 1, 'keys.auth': 1, 'keys.p256dh': 1 }
                );
    
                if (subscriptions?.length){
                    const expiredSubscriptions = [];
                    for (const subscription of subscriptions){
                        try {
                            await webPush.sendNotification(subscription, JSON.stringify({
                                type: NotificationType.NEW_COMMENT,
                                emitter: {
                                    _id: user._id,
                                    username: user.username
                                },
                                url: `${process.env.FRONT_URL}/post/${post._id}`
                            }));
                        } catch {
                            expiredSubscriptions.push(subscription._id);
                        }
                    }
                    if (expiredSubscriptions.length){
                        if (!await Subscription.deleteMany({_id: expiredSubscriptions})){
                            throw(new Error(`Failed to deleteMany Subscription with _ids ${expiredSubscriptions.join()}`));
                        }
                    }
                }
            }

            response
            .status(200)
            .send({
                _id: newComment._id,
                text: newComment.text,
                user: user
            });

        } catch(error){

            response
            .status(error instanceof ServerException ? error.httpCode : 500)
            .send({
                errors: error instanceof ServerException ? error.messages : ['Erreur interne du serveur']
            });
        }
    }

    edit = async (request: Request, response: Response) =>
    {
        try {

            const user = await User.findById(request.session.user.id, {
                _id: 1
            });

            if (!user){
                throw(new ServerException(['Non autorisé'], 401));
            }

            const comment = await Comment.findById(request.params.commentId);

            if (!comment){
                throw(new ServerException([`comment ${request.params.commentId} n'existe pas`], 400));
            }

            if (!comment.user._id.equals(user._id)){
                throw(new ServerException(['Interdit'], 403));
            }
            
            const data = request.body;
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
                errors: error instanceof ServerException ? error.messages : ['Erreur interne du serveur']
            });
        }
    }

    delete = async (request: Request, response: Response) =>
    {
        try {

            const comment = await Comment.findById(request.params.commentId);

            if (!comment){
                throw(new ServerException([`comment ${request.params.commentId} n'existe pas`], 400));
            }

            if (!comment.user._id.equals(request.session.user.id)){
                throw(new ServerException(['Interdit'], 403));
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
                errors: error instanceof ServerException ? error.messages : ['Erreur interne du serveur']
            });
        }
    }
}