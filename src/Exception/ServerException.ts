export default class CustomException
{
    httpCode: number;
    messages: string[];
    constructor(messages: string[], httpCode: number = 500)
    {
        this.messages = messages;
        this.httpCode = httpCode;
    }
}