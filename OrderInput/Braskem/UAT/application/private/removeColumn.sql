/* 20180118 */

ALTER TABLE `entries` RENAME TO `tmp_entries`;

/* Create the new table with removed columns */

CREATE TABLE IF NOT EXISTS `entries` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `requestno` INTEGER, `custcode` VARCHAR(255), `opcode` VARCHAR(255), `costcenter` VARCHAR(255), `extid` VARCHAR(255), `eta` VARCHAR(255), `arrived` VARCHAR(255), `vessel` VARCHAR(255), `voyage` VARCHAR(255), `billoflading` VARCHAR(255), `quay` VARCHAR(255), `lloyd` VARCHAR(255), `pickup` VARCHAR(255), `shipno` VARCHAR(255), `agentcode` VARCHAR(255), `warehouse` VARCHAR(255), `tabledata` VARCHAR(255), `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL);

-- Populate it with the old data:

INSERT INTO `entries` (`id`, `requestno`, `custcode`, `opcode`, `costcenter`, `extid`, `eta`, `arrived`, `vessel`, `voyage`, `billoflading`, `quay`, `lloyd`, `pickup`, `shipno`, `agentcode`, `warehouse`, `tabledata`, `createdAt`, `updatedAt`) SELECT `id`, `requestno`, `custcode`, `opcode`, `costcenter`, `extid`, `eta`, `arrived`, `vessel`, `voyage`, `billoflading`, `quay`, `lloyd`, `pickup`, `shipno`, `agentcode`, `warehouse`, `tabledata`, `createdAt`, `updatedAt` FROM tmp_entries;

-- delete temp table
DROP TABLE `tmp_entries`;