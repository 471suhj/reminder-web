import { PrimaryColumn, ViewColumn, ViewEntity } from "typeorm";

@ViewEntity({
    name: 'friend_mul',
    expression:`
    select friend_mono.user_serial_to, friend_mono.user_serial_from, friend.date_added, friend_mono.nickname
    from friend inner join friend_mono using (user_serial_to, user_serial_from)
	union
	select friend_mono.user_serial_to, friend_mono.user_serial_from, friend.date_added, friend_mono.nickname
    from friend inner join friend_mono
    on friend.user_serial_to=friend_mono.user_serial_from and friend.user_serial_from=friend_mono.user_serial_to
    `
})
export class Efriend_mul{

    @PrimaryColumn()
    user_serial_to: number;

    @PrimaryColumn()
    user_serial_from: number;

    @ViewColumn()
    date_added: Date;

    @ViewColumn()
    nickname: string;

}