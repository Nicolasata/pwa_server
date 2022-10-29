import { Document, Schema, model } from 'mongoose';
import { IMedia } from './MediaSchema';
import { IUser } from './UserSchema';

export interface IPost extends Document
{
    user: IUser;
    media: IMedia;
    likes: IUser[];
    description: string;
};

const PostSchema = new Schema<IPost>({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    media: {
        type: Schema.Types.ObjectId,
        ref: 'Media',
        default: null
    },
    likes: {
        type: [Schema.Types.ObjectId],
        ref: 'User',
        default: []
    },
    description: {
        type: String,
        default: null
    }
},
{
    timestamps: true,
    collection: 'posts'
});

export const Post = model<IPost>('Post', PostSchema);