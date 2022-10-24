
import mongoose, { ConnectOptions } from 'mongoose';
import { setVapidDetails } from 'web-push';
import { join, resolve } from 'path';
import Routable from './Interface/Routable'
import * as cookieParser from 'cookie-parser';
import * as session from 'express-session';
import * as cors from 'cors';
import * as connectMongoDBSession from 'connect-mongodb-session';
import * as express from 'express';
import 'reflect-metadata'

export default class Application
{
    public application: express.Application;
    public controllers: Routable[];

    constructor(controllers: Routable[])
    {
        this.application = express();
        this.controllers = controllers;
    }

    async initialiseDB()
    {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        } as ConnectOptions)
        .then(() => console.log(`Connected to ${process.env.MONGODB_URI}`))
        .catch((error) => console.error(error.message));
    }

    initiliseWebPush()
    {
        setVapidDetails(
            'https://serviceworke.rs/',
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );
    }

    initialiseExpress()
    {
        this.application.use('/media', express.static(join(`${resolve('./')}/public/uploads`)));
        this.application.use(cookieParser());
        this.application.use(express.json({
            limit: '50mb'
        }));
        this.application.use(cors({
            origin : true,
            credentials: true
        }));
        const mongoDbSession = connectMongoDBSession(session);
        this.application.use(session({
            secret: process.env.SESSION_SECRET,
            resave: false,
            saveUninitialized: false,
            store: new mongoDbSession({
                uri: process.env.MONGODB_URI,
                collection: 'sessions'
            })
        }));
    }

    initialiseControllers()
    {
        for (const controller of this.controllers){
            controller.initialiseRouter();
            this.application.use(controller.route, controller.router);
        }
    }

    async initialise()
    {
        await this.initialiseDB();
        this.initialiseExpress();
        this.initialiseControllers();
        this.initiliseWebPush();
    }

    start()
    {
        this.application.listen(3000, () => {
            console.log(`App started on port 3000`);
        })
    }
}