import { Column, Entity, Generated, Index, JoinColumn, ManyToOne, OneToOne, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";
import { Efile } from "./file.entity";
import { Efriend_mono } from "./friend_mono.entity";
import { Ebookmark } from "src/mysql/bookmark.entity";

@Entity('shared_def')
export class Eshared_def {
    
    @PrimaryColumn({type: 'int', unsigned: true})
    user_serial_to: number;
        
    @PrimaryColumn({type: 'int', unsigned: true})
    user_serial_from: number;

    @OneToOne(()=>Efriend_mono, {nullable: false})
    @JoinColumn([
        {name: 'user_serial_to', referencedColumnName: 'user_serial_to'},
        {name: 'user_serial_from', referencedColumnName: 'user_serial_from'},
    ])
    friend_mono: Efriend_mono;

    @ManyToOne(()=>Efile, (file)=>file.shares, {nullable: false})
    @JoinColumn({name: 'file_serial', referencedColumnName: 'file_serial'})
    file: Efile;

    @ManyToOne(()=>Ebookmark, (val)=>val.shares, {createForeignKeyConstraints: false})
    @JoinColumn({name: 'file_serial', referencedColumnName: 'file_serial'})
    file_serial_2: Ebookmark;

    @PrimaryColumn({type: 'bigint', unsigned: true})
    file_serial: string;

    @Column({type: 'char', length: 40})
    file_name: string;
    
    @Column({type: 'timestamp', default: '2000-01-01 00:00:00'})
    date_shared: Date;
    
    @Column({type: 'enum', enum: ['read', 'edit']})
    share_type: 'read'|'edit';
    
    @Column({type: 'enum', enum: ['false', 'true'], default: 'false'})
    bookmarked: 'false'|'true';
    
    @Column({type: 'timestamp', default: ()=>'CURRENT_TIMESTAMP'})
    last_opened: Date;
}