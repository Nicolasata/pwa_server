import { Document, Schema, Types, model } from 'mongoose';

interface IKeys extends Document {
    auth: string;
    p256dh: string;
}

interface ISubscription extends Document {
    user: Types.ObjectId;
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

const SubscriptionModel = model<ISubscription>('Subscription', SubscriptionSchema);

export default SubscriptionModel;