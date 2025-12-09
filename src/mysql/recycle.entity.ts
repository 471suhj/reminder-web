import { Column, Entity, Index, JoinColumn, OneToOne, PrimaryColumn } from "typeorm";
import { Euser } from "./user.entity";

@Entity('recycle')
@Index(['user_serial', 'mark'])
export class Erecycle {

    @OneToOne(()=>Euser)
    @JoinColumn({name: 'user_serial', referencedColumnName: 'user_serial'})
    user: Euser;

    @PrimaryColumn({type: 'int', unsigned: true})
    user_serial: number;

    @Column({type: 'bigint', unsigned: true})
    parent_serial: number;

    @Column({type: 'varchar', length: 255})
    parent_path: string;

    @PrimaryColumn({type: 'enum', enum: ['dir', 'file'], default: 'dir'})
    type: 'dir'|'file';

    @PrimaryColumn({type: 'varchar', length: 40})
    file_name: string;

    @Index({unique: true})
    @PrimaryColumn({type: 'bigint', unsigned: true})
    file_serial: number;

    @Column({type: 'timestamp', default: ()=>'CURRENT_TIMESTAMP'})
    last_renamed: Date;

    @Column({type: 'timestamp'})
    last_modified: Date;

    @Column({type: 'enum', enum: ['direct', 'recursive']})
    del_type: 'direct'|'recursive';

    @Column({type: 'enum', enum: ['false', 'true'], default: 'false'})
    to_restore: 'false'|'true';

    @Column({type: 'enum', enum: ['false', 'true'], default: 'false'})
    to_delete: 'false'|'true';

    @Column({type: 'enum', enum: ['false', 'true'], default: 'false'})
    mark: 'false'|'true';

}