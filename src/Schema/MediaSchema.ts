import { Document, Schema, Types, model } from 'mongoose';
import { IPost } from './PostSchema';
import { IUser } from './UserSchema';

export interface IMedia extends Document {
    user: IUser;
    parentSchema: string;
    parent: IUser|IPost;
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
    parentSchema : {
        type: String,
        enum: [null, 'User', 'Post'],
        default: null
    },
    parent : {
        type: Schema.Types.ObjectId,
        refPath: 'parentSchema',
        default: null
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