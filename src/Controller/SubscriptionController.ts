
import ServerException from '../Exception/ServerException';
import Routable from '../Interface/Routable';
import DTOValidator from '../Middlewares/DTOValidator';
import IsAuthenticated from '../Middlewares/IsAuthenticated';

import { Subscription } from '../Schema/SubscriptionSchema';
import { Save } from '../DTO/SubscriptionDTO';
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
    }

    save = async (request: Request, response: Response) =>
    {
        try {

            const user = await User.findById(request.session.user.id, {
                _id: 1
            });

            if (!user) {
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