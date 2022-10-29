import { Document, Schema, model } from 'mongoose';
import { IUser } from './UserSchema';

interface IKeys
{
    auth: string;
    p256dh: string;
}

export interface ISubscription extends Document
{
    user: IUser;
    endpoint: string;
    keys: IKeys
};

const KeysSchema = new Schema<IKeys>({
    auth: {
        type: String,
        required: true
    },
    p256dh: {
        type: String,
        required: true
    }
});

const SubscriptionSchema = new Schema<ISubscription>({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    endpoint: {
        type: String,
        required: true
    },
    keys: {
        type: KeysSchema,
        required: true
    }
},
{
    timestamps: true,
    collection: 'subscriptions'
});

export const Subscription = model<ISubscription>('Subscription', SubscriptionSchema);