import Routable from '../Interface/Routable';
import Subscription from '../Schema/SubscriptionSchema';
import ServerException from '../Exception/ServerException';
import { validate } from 'class-validator';
import { ClassConstructor, plainToClass } from 'class-transformer';

import SaveDTO from '../DTO/Subscription/Save';

import * as express from 'express';

export default class SubscriptionController implements Routable
{
    route: string;
    router: express.Router;
    constructor()
    {
        this.router = express.Router();
        this.route = '/subscription';
    }

    initialiseRouter()
    {
        this.router.get('/getPublicKey', this.getPublicKey);
        this.router.post('/save', this.save);
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

            const newSubscription = new Subscription({
                user: request.session.user.id,
                endpoint: data.endpoint,
                auth: data.auth,
                p256dh: data.p256dh
            });

            if (!await newSubscription.save()){
                throw(new Error('Failed to save Subscription'));
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

    getPublicKey = async (request: express.Request, response: express.Response) =>
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
            })
        }
    }
}