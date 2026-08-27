import type { AppError } from '@/types';
import type { Result } from '@/utils';

/** Every service method resolves to a Result — services never throw. */
export type ServiceResult<T> = Promise<Result<T, AppError>>;

/**
 * Shared lifecycle so the registry can warm up and tear down services
 * uniformly (e.g. loading an on-device model, releasing an audio session).
 */
export type Service = {
  readonly id: string;
  /** Called once during app start-up. Must be idempotent. */
  initialize?(): ServiceResult<void>;
  dispose?(): Promise<void>;
  /** Whether the service can be used right now (permissions, model present…). */
  isAvailable(): Promise<boolean>;
};
