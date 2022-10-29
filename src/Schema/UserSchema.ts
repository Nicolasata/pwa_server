import { Document, Schema, model } from 'mongoose';
import { IMedia } from './MediaSchema'
import { ISubscription } from './SubscriptionSchema';

export interface IUser extends Document
{
    username: string;
    password: string;
    description: string;
    email: string;
    media: IMedia;
    followers: IUser[],
    following: IUser[],
    likes: IUser[],
    subscriptions?: ISubscription[],
    deletedAt: Date;
};

const UserSchema = new Schema<IUser>({
    username: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: null
    },
    email: {
        type: String,
        required: true
    },
    media: {
        type: Schema.Types.ObjectId,
        ref: 'Media',
        default: null
    },
    followers: {
        type: [Schema.Types.ObjectId],
        ref: 'User',
        default: []
    },
    following: {
        type: [Schema.Types.ObjectId],
        ref: 'User',
        default: []
    },
    likes: {
        type: [Schema.Types.ObjectId],
        ref: 'Post',
        default: []
    },
    subscriptions: {
        type: [Schema.Types.ObjectId],
        ref: 'Subscription',
        default: []
    },
    deletedAt: {
        type: Date,
        default: null
    }
},
{
    timestamps: true,
    collection: 'users'
});

export const User = model<IUser>('User', UserSchema);