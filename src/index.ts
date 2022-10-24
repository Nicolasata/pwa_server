import Application from './Application'
import UserController from './Controller/UserController'
import SubscriptionController from './Controller/SubscriptionController'
import PostController from './Controller/PostController'
import { VisitorSession, UserSession } from './Session'

declare module 'express-session' {
    interface SessionData {
        user: UserSession;
        visitor: VisitorSession
    }
};

const application = new Application([
    new UserController,
    new SubscriptionController,
    new PostController
]);

application.initialise();
application.start();