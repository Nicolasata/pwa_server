import { Document, Schema, Types, model } from 'mongoose';
import { IUser } from './UserSchema';

export interface IMedia extends Document {
    user: IUser;
    mimetype: string;
    filename: string;
    originalName: string;
    location: string;
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
    originalName: {
        type: String,
        required: true
    },
    location: {
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