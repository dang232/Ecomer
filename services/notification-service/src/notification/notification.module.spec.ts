import { MODULE_METADATA } from '@nestjs/common/constants';

import { NotificationModule } from './notification.module';
import { NotificationPreferencesController } from './infrastructure/rest/notification-preferences.controller';
import { NotificationRestController } from './infrastructure/rest/notification.controller';

describe('NotificationModule route ordering', () => {
  it('registers preferences before the generic notification id route', () => {
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      NotificationModule,
    ) as unknown[];

    expect(controllers.indexOf(NotificationPreferencesController)).toBeLessThan(
      controllers.indexOf(NotificationRestController),
    );
  });
});
