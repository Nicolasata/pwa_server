import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function HasNumber(validationOptions?: ValidationOptions)
{
    return function (object: Object, propertyName: string)
    {
        registerDecorator({
            name: 'HasNumber',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: {
                defaultMessage() {
                    return (`${propertyName} must contain at least one number`);
                },
                validate(value: any, args: ValidationArguments) {
                    return (/\d/.test(value));
                }
            }
        });
    }
}