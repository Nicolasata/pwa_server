import { validate } from 'class-validator';

export default class DTOValidator
{
    async validateDTO(data: object): Promise<string[]>
    {
        const errors = await validate(data, {
            skipMissingProperties: false,
            stopAtFirstError: true,
            whitelist: true
        });
        const messages = [];
        if (errors?.length){
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
        }
        return (messages);
    }
};