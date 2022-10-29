
import mongoose, { ConnectOptions } from 'mongoose';
import { setVapidDetails } from 'web-push';
import { join, resolve } from 'path';
import Routable from './Interface/Routable'
import MongoStore from 'connect-mongo';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Application as ExpressApplication } from 'express';

import 'reflect-metadata'

export default class Application
{
    public application: ExpressApplication;
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
        this.application.use(session({
            secret: process.env.SESSION_SECRET,
            resave: false,
            saveUninitialized: false,
            store: MongoStore.create({
                mongoUrl: process.env.MONGODB_URI,
                crypto: {
                    secret: process.env.MONGO_STORE_SECRET
                }
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

    async start()
    {
        await this.initialise();
        this.application.listen(parseInt(process.env.SERVER_PORT), () => {
            console.log(`App started on port ${process.env.SERVER_PORT}`);
        })
    }
}