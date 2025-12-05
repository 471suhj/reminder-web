import { Column, Entity, Generated, Index, JoinColumn, OneToOne, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";
import { Efriend_mono } from "./friend_mono.entity";

@Entity('friend')
@Index(['user_serial_from', 'user_serial_to'])
export class Efriend {
    
    @PrimaryColumn({type: 'int', unsigned: true})
    user_serial_to: number;
    
    @PrimaryColumn({type: 'int', unsigned: true})
    user_serial_from: number;

    @OneToOne(()=>Efriend_mono, {nullable: false})
    @JoinColumn([
        {name: 'user_serial_to', referencedColumnName: 'user_serial_to'},
        {name: 'user_serial_from', referencedColumnName: 'user_serial_from'},
    ])
    user_serial_2: Efriend_mono;

    @OneToOne(()=>Efriend_mono, {nullable: false})
    @JoinColumn([
        {name: 'user_serial_to', referencedColumnName: 'user_serial_from'},
        {name: 'user_serial_from', referencedColumnName: 'user_serial_to'},
    ])
    user_serial_1: Efriend_mono;

    @Column({type: 'timestamp', default: ()=>'CURRENT_TIMESTAMP'})
    date_added: Date;
}