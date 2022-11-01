import { Response, Request, NextFunction } from 'express';

export default (request: Request, response: Response, next: NextFunction) => {

    if (!request.session?.user?.id){
        return response
        .status(401)
        .send({
            errors: [ 'Unauthorized' ]
        });
    }
    next();
};