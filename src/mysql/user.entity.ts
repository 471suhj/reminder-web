import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity('user')
export class Euser {
    @PrimaryGeneratedColumn('increment', {type: 'int', unsigned: true})
    user_serial: number;

    @Index({unique: true})
    @Column({type: 'char', length: 25})
    user_id: string;

    @Column({type: 'char', length: 25})
    name: string;

    @Column({type: 'char', length: 30})
    password: string;

    @Column({type: 'varchar', length: 22})
    salt: string;

    @Column({type: 'char', length: 65})
    email: string;

    @Column({type: 'varchar', length: 255, default: ''})
    email2: string;

    @Column({type: 'enum', enum: ['false', 'true'], default: 'true'})
    auto_receive_files: 'false'|'true';

    @Column({type: 'enum', enum: ['false', 'true'], default: 'true'})
    save_recent: 'false'|'true';

    @Column({type: 'enum', enum: ['false', 'true'], default: 'true'})
    recycle_path: 'false'|'true';

    @Column({type: 'enum', enum: ['false', 'true'], default: 'true'})
    side_bookmarks: 'false'|'true';

    @Column({type: 'enum', enum: ['false', 'true'], default: 'true'})
    side_shared: 'false'|'true';

    @Column({type: 'enum', enum: ['false', 'true'], default: 'true'})
    home_bookmarks: 'false'|'true';

    @Column({type: 'enum', enum: ['false', 'true'], default: 'true'})
    home_notifs: 'false'|'true';

    @Column({type: 'enum', enum: ['false', 'true'], default: 'true'})
    home_files: 'false'|'true';

    @Column({type: 'enum', enum: ['false', 'true'], default: 'true'})
    home_shared: 'false'|'true';

    @Column({type: 'enum', enum: ['false', 'true'], default: 'false'})
    user_deleted: 'false'|'true';

    @Column({type: 'timestamp', default: ()=>'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP'})
    last_updated: Date;
}