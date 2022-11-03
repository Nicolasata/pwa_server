
import ServerException from '../Exception/ServerException';
import Routable from '../Interface/Routable';
import DTOValidator from '../Middlewares/DTOValidator';
import IsAuthenticated from '../Middlewares/IsAuthenticated';

import { Subscription } from '../Schema/SubscriptionSchema';
import { Delete, Save } from '../DTO/SubscriptionDTO';
import { Router, Response, Request } from 'express';
import { User } from '../Schema/UserSchema';

export default class SubscriptionController implements Routable
{
    route: string;
    router: Router;
    constructor()
    {
        this.router = Router();
        this.route = '/subscription';
    }

    initialiseRouter()
    {
        this.router.get('/getPublicKey', IsAuthenticated, this.getPublicKey);
        this.router.post('/save', IsAuthenticated, DTOValidator(Save), this.save);
        this.router.delete('/delete/:subscriptionId', IsAuthenticated, this.deleteOne);
        this.router.delete('/delete', IsAuthenticated, DTOValidator(Delete), this.deleteMany);
    }

    save = async (request: Request, response: Response) =>
    {
        try {

            const user = await User.findById(request.session.user.id, {
                _id: 1
            });

            if (!user){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const data = request.body;
            const newSubscription = new Subscription({
                user: user._id,
                ...data
            });

            if (!await newSubscription.save()){
                throw(new Error('Failed to save Subscription'));
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

    deleteOne = async (request: Request, response: Response) =>
    {
        try {

            const user = await User.findById(request.session.user.id, {
                _id: 1
            });

            if (!user){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const subscription = await Subscription.findById(request.params.subscriptionId);

            if (!subscription){
                throw(new ServerException([`subscription ${request.params.subscriptionId} does not exist`], 400));
            }

            if (!subscription.user._id.equals(request.session.user.id)){
                throw(new ServerException(['Prohibited'], 403));
            }

            if (!await Subscription.deleteOne({_id: subscription._id})){
                throw(new Error(`Failed to deleteOne Subscription with _id ${subscription._id}`));
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

    deleteMany = async (request: Request, response: Response) =>
    {
        try {

            const user = await User.findById(request.session.user.id, {
                _id: 1
            });

            if (!user){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const data = request.body;
            const subscriptions = await Subscription.find(
                { _id: data.subscriptions },
                { _id: 1, user: 1 }
            );

            if (subscriptions?.length){

                const subscriptionIds = [];
                for (const subscription of subscriptions){
    
                    if (!subscription.user._id.equals(user._id)){
                        throw(new ServerException(['Prohibited'], 403));
                    }
                    subscriptionIds.push(subscription._id);
                }
    
                if (!await Subscription.deleteMany({_id: subscriptionIds})){
                    throw(new Error(`Failed to deleteMany Subscription with _ids ${subscriptionIds.join()}`));
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

    getPublicKey = async (request: Request, response: Response) =>
    {
        try {

            response
            .status(200)
            .send({
                publicKey: process.env.VAPID_PUBLIC_KEY
            });

        } catch(error){

            response
            .status(error instanceof ServerException ? error.httpCode : 500)
            .send({
                errors: error instanceof ServerException ? error.messages : ['Internal server error']
            });
        }
    }
}