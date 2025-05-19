
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ required: true })
  requestId: string;

  @Prop({ required: true, index: true })
  timestamp: Date;

  @Prop()
  userId?: string;

  @Prop()
  userRoles?: string[];

  @Prop({ required: true })
  ipAddress: string;

  @Prop({ required: true })
  httpMethod: string;

  @Prop({ required: true })
  originalUrl: string;

  @Prop()
  routedService?: string;

  @Prop({ required: true })
  statusCode: number;

  @Prop()
  userAgent?: string;

  @Prop({ type: Object })
  requestHeaders?: Record<string, any>;

  @Prop({ type: Object })
  requestBody?: Record<string, any>;

  @Prop({ type: Object })
  responseBody?: Record<string, any>;

  @Prop()
  authenticationStatus: 'success' | 'failure' | 'not_attempted';

  @Prop()
  authorizationStatus: 'success' | 'failure' | 'not_applicable';

  @Prop()
  errorMessage?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  performedBy?: Types.ObjectId;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ userId: 1 });
AuditLogSchema.index({ routedService: 1 });
AuditLogSchema.index({ statusCode: 1 });