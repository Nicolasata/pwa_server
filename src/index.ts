import Application from './Application'
import UserController from './Controller/UserController'
import SubscriptionController from './Controller/SubscriptionController'
import PostController from './Controller/PostController'
import CommentController from './Controller/CommentController'
import UploadController from './Controller/UploadController'
import { UserSession } from './Session'

declare module 'express-session' {
    interface SessionData {
        user: UserSession;
    }
};

const application = new Application([
    new UserController,
    new SubscriptionController,
    new PostController,
    new CommentController,
    new UploadController
]);

application.start();