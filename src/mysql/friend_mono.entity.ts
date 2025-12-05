import { Column, Entity, Generated, JoinColumn, OneToOne, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";
import { Euser } from "./user.entity";

@Entity('freind_mono')
export class Efriend_mono {
    
    @PrimaryColumn({type: 'int', unsigned: true})
    user_serial_to: number;
    
    @PrimaryColumn({type: 'int', unsigned: true})
    user_serial_from: number;

    @OneToOne(()=>Euser, {nullable: false})
    @JoinColumn({name: 'user_serial_to', referencedColumnName: 'user_serial'})
    user_serial_1: Euser;

    @OneToOne(()=>Euser, {nullable: false})
    @JoinColumn({name: 'user_serial_from', referencedColumnName: 'user_serial'})
    user_serial_2: Euser;

    @Column({type: 'char', length: 25, default: ''})
    nickname: string;
}
