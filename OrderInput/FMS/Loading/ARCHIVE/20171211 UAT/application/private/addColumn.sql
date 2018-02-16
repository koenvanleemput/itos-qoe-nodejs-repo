ALTER TABLE `entries` RENAME TO `tmp_entries`;

/* Create the new table with the missing column: */

CREATE TABLE `entries` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `custcode` VARCHAR(255), `extid` VARCHAR(255), `requestno` INTEGER, `costcenter` VARCHAR(255), `opcode` VARCHAR(255), `planneddate` VARCHAR(255), `lictruck` VARCHAR(255), `lictrail` VARCHAR(255), `tptcompany` VARCHAR(255), `tptsequence` VARCHAR(255), `tabledata` VARCHAR(255), `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL);

-- And populate it with the old data:

INSERT INTO `entries` (`id`, `custcode`, `extid`, `requestno`, `costcenter`, `opcode`, `planneddate`, `lictruck`, `lictrail`, `tptcompany`, `tptsequence`, `tabledata`, `createdAt`, `updatedAt`) SELECT `id`, `custcode`, `extid`, `requestno`, `costcenter`, `opcode`, `planneddate`, `lictruck`, `lictrail`, `tptcompany`, '10', `tabledata`, `createdAt`, `updatedAt` from `tmp_entries`;

-- delete temp table
DROP TABLE `tmp_entries`;
