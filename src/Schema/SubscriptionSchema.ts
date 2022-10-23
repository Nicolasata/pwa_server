import { Document, Schema, Types, model  } from 'mongoose';

interface ISubscription extends Document {
    user: Types.ObjectId;
    endpoint: string;
    auth: string;
    p256dh: string;
};

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
    auth: {
        type: String,
        required: true
    },
    p256dh: {
        type: String,
        required: true
    }
},
{
    timestamps: true,
    collection: 'subscriptions'
});

const SubscriptionModel = model<ISubscription>('Subscription', SubscriptionSchema);

export default SubscriptionModel;