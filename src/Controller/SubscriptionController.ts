
import ServerException from '../Exception/ServerException';
import Routable from '../Interface/Routable';
import DTOValidator from '../Class/DTOValidator';

import { Subscription } from '../Schema/SubscriptionSchema';
import { plainToInstance } from 'class-transformer';
import { Save } from '../DTO/SubscriptionDTO';
import { Router, Response, Request } from 'express';

export default class SubscriptionController extends DTOValidator implements Routable
{
    route: string;
    router: Router;
    constructor()
    {
        super();
        this.router = Router();
        this.route = '/subscription';
    }

    initialiseRouter()
    {
        this.router.get('/getPublicKey', this.getPublicKey);
        this.router.post('/save', this.save);
    }

    save = async (request: Request, response: Response) =>
    {
        try {

            if (!request.session?.user?.id){
                throw(new ServerException(['Unauthorized'], 401));
            }

            const data = plainToInstance(Save, request.body);
            const errors = await super.validateDTO(data);

            if (errors?.length){
                throw(new ServerException(errors, 400));
            }

            const newSubscription = new Subscription({
                user: request.session.user.id,
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

            if (!request.session?.user?.id){
                throw(new ServerException(['Unauthorized'], 401));
            }

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