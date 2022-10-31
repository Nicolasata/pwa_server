import { RequestHandler } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { sanitize } from 'class-sanitizer';
import { Response, Request, NextFunction } from 'express';

export default function DTOValidator(type: any): RequestHandler
{
  return async (request: Request, response: Response, next: NextFunction) =>
  {
    const data = plainToInstance(type, request.body);
    const errors = await validate(data, {
        skipMissingProperties: false,
        stopAtFirstError: true,
        whitelist: true
    });
    if (!errors?.length){
        sanitize(data);
        request.body = data;
        return (next());
    }
    const messages = [];
    for (const error of errors){
        if (error.constraints){
            for (const [constraint, message] of Object.entries(error.constraints)) {
                messages.push(message);
            }
        }
        if (error.children){
            for (const children of error.children){
                for (const [constraint, message] of Object.entries(children.constraints)) {
                    messages.push(message);
                }
            }
        }
    }
    response
    .status(400)
    .send({
        errors: messages
    })
  };
}