import * as express from 'express'

export default interface Routable
{
    router: express.Router;
    route: string;
    initialiseRouter: () => void;
};