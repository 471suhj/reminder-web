import { Column, Entity, Generated, Index, JoinColumn, OneToMany, OneToOne, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";
import { Euser } from "./user.entity";

@Entity('file')
@Index(['user_serial', 'mark'])
export class Efile {
    @OneToMany(()=>Euser, (user)=>user.user_serial)
    @PrimaryColumn({primary: true, type: 'int', unsigned: true})
    user_serial: number;
    
    @Column({type: 'enum', enum: ['false', 'true'], default: 'false'})
    bookmarked: 'false'|'true';
    
    @PrimaryColumn({type: 'int', unsigned: true})
    parent_serial: number;

    @OneToOne(()=>Efile, {nullable: false})
    @JoinColumn({name: 'parent_serial', referencedColumnName: 'file_serial'})
    parent_serial_1: Efile;
    
    @PrimaryColumn({type: 'enum', enum: ['dir', 'file', 'movedir', 'movefile'], default: 'dir'})
    type: 'dir'|'rmb0.3';
    
    @Column({type: 'enum', enum: ['false', 'true'], default: 'false'})
    issys: 'false'|'true';
    
    @PrimaryColumn({type: 'char', length: 40})
    file_name: string;
    
    @Index({unique: true})
    @Generated('increment')
    @Column({type: 'bigint', unsigned: true})
    file_serial: number;
    
    @Column({type: 'timestamp', default: ()=>'CURRENT_TIEMSTAMP'})
    last_renamed: Date;
    
    @Column({type: 'timestamp', default: ()=>'CURRENT_TIEMSTAMP'})
    last_modified: Date;
    
    @Column({type: 'timestamp', default: '2000-01-01 00:00:00'})
    last_opened: Date;
    
    @Column({type: 'enum', enum: ['direct', 'recursive', 'na'], default: 'na'})
    to_delete: 'direct'|'recursive'|'na';
    
    @Column({type: 'enum', enum: ['false', 'true'], default: 'false'})
    mark: 'false'|'true';
}