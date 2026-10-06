import { entity, role, text, date, uuid } from '@microsoft/rayfin-core';

@entity()
@role('authenticated', '*', {
  policy: (claims, item) => claims.sub.eq(item.user_id),
})
export class Person {
  @uuid() id!: string;
  @text({ min: 1, max: 200 }) name!: string;
  @date() createdAt!: Date;
  @text({ max: 128 }) user_id!: string;
}
