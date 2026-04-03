import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { connect, MqttClient } from 'mqtt';
import { ENV } from '../env';
import { AuditEvent, AuditEventType } from '../types';
import { RunStateService } from './run-state.service';

@Injectable()
export class AuditPublisherService implements OnApplicationShutdown {
  private client?: MqttClient;
  private connectPromise?: Promise<MqttClient | null>;

  constructor(private readonly runState: RunStateService) {}

  async publish(type: AuditEventType, payload: Record<string, any>): Promise<void> {
    if (!ENV.MQTT_AUDIT_ENABLED) return;

    const client = await this.ensureClient();
    if (!client) {
      throw new Error('MQTT audit client unavailable');
    }

    const snapshot = this.runState.getSnapshot();
    const event = this.buildEvent(type, payload, snapshot);
    await new Promise<void>((resolve, reject) => {
      client.publish(
        event.topic,
        JSON.stringify(event),
        {
          qos: this.normalizeQos(ENV.MQTT_AUDIT_QOS),
          retain: ENV.MQTT_AUDIT_RETAIN,
        },
        (err?: Error) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.client) return;
    await new Promise<void>((resolve) => {
      this.client?.end(true, {}, () => resolve());
    });
    this.client = undefined;
    this.connectPromise = undefined;
  }

  private async ensureClient(): Promise<MqttClient | null> {
    if (this.client?.connected) return this.client;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise<MqttClient | null>((resolve) => {
      const client = connect(ENV.MQTT_AUDIT_URL, {
        username: ENV.MQTT_AUDIT_USERNAME || undefined,
        password: ENV.MQTT_AUDIT_PASSWORD || undefined,
        clientId: ENV.MQTT_AUDIT_CLIENT_ID,
        reconnectPeriod: 5000,
      });

      const cleanup = () => {
        client.removeListener('connect', onConnect);
        client.removeListener('error', onError);
      };

      const onConnect = () => {
        cleanup();
        this.client = client;
        this.connectPromise = undefined;
        client.on('close', () => {
          this.client = undefined;
        });
        resolve(client);
      };

      const onError = () => {
        cleanup();
        try { client.end(true); } catch {}
        this.client = undefined;
        this.connectPromise = undefined;
        resolve(null);
      };

      client.once('connect', onConnect);
      client.once('error', onError);
    });

    return this.connectPromise;
  }

  private buildEvent(type: AuditEventType, payload: Record<string, any>, snapshot: ReturnType<RunStateService['getSnapshot']>): AuditEvent {
    const repoId = snapshot.context?.repoId;
    const runId = snapshot.context?.runId;
    const branch = snapshot.context?.branchName;
    const topic = [
      ENV.MQTT_AUDIT_TOPIC_PREFIX.replace(/\/+$/, ''),
      repoId || 'unknown-repo',
      runId || 'no-run',
      type,
    ].join('/');

    return {
      type,
      ts: Date.now(),
      app: ENV.APPNAME,
      version: ENV.VERSION,
      repoId,
      runId,
      branch,
      topic,
      snapshot,
      payload,
    };
  }

  private normalizeQos(value: number): 0 | 1 | 2 {
    if (value === 1 || value === 2) return value;
    return 0;
  }
}
