import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function HasUppercase(validationOptions?: ValidationOptions)
{
    return function (object: Object, propertyName: string)
    {
        registerDecorator({
            name: 'HasUppercase',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: {
                defaultMessage() {
                    return (`${propertyName} must contain at least one capital letter`);
                },
                validate(value: any, args: ValidationArguments) {
                    return (/[A-Z]/.test(value));
                }
            }
        });
    }
}