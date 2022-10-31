import { Document, Schema, Types, model } from 'mongoose';
import { IUser } from './UserSchema';

export interface IMedia extends Document {
    user: IUser;
    mimetype: string;
    filename: string;
    originalname: string;
    path: string;
    url: string;
    size: number;
};

const MediaSchema = new Schema<IMedia>({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    mimetype: {
        type: String,
        required: true
    },
    filename: {
        type: String,
        required: true
    },
    originalname: {
        type: String,
        required: true
    },
    path: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    }
},
{
    timestamps: true,
    collection: 'medias'
});

export const Media = model<IMedia>('Media', MediaSchema);