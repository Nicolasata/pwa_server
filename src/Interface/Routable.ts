import { Router } from 'express'

export default interface Routable
{
    router: Router;
    route: string;
    initialiseRouter: () => void;
};