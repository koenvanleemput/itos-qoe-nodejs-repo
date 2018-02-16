/* rename column tptsequence to oisequence */

ALTER TABLE `entries` RENAME TO `tmp_entries`;

/* Create the new table with the renamed column: */

CREATE TABLE `entries` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `custcode` VARCHAR(255), `extid` VARCHAR(255), `lot` VARCHAR(255), `oisequence` VARCHAR(255), `createtransport` TINYINT(1), `requestno` INTEGER, `costcenter` VARCHAR(255), `opcode` VARCHAR(255), `planneddate` VARCHAR(255), `lictruck` VARCHAR(255), `lictrail` VARCHAR(255), `tptcompany` VARCHAR(255), `tabledata` VARCHAR(255), `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL);

-- And populate it with the old data:

INSERT INTO `entries` (`id`, `custcode`, `extid`, `lot`, `oisequence`, `createtransport`, `requestno`, `costcenter`, `opcode`, `planneddate`, `lictruck`, `lictrail`, `tptcompany`, `tabledata`, `createdAt`, `updatedAt`) SELECT `id`, `custcode`, `extid`, `lot`, `tptsequence`, `createtransport`, `requestno`, `costcenter`, `opcode`, `planneddate`, `lictruck`, `lictrail`, `tptcompany`, `tabledata`, `createdAt`, `updatedAt` from `tmp_entries`;

-- delete temp table
DROP TABLE `tmp_entries`;



/* drop column tptsequence */

ALTER TABLE `transportrefs` RENAME TO `tmp_transportrefs`;

/* Create the new table with the renamed column: */

CREATE TABLE `transportrefs` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `planneddate` VARCHAR(255), `lictruck` VARCHAR(255), `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL);

-- And populate it with the old data:

INSERT INTO `transportrefs` (`id`, `planneddate`, `lictruck`, `createdAt`, `updatedAt`) SELECT `id`, `planneddate`, `lictruck`, `createdAt`, `updatedAt` from `tmp_transportrefs`;

-- delete temp table
DROP TABLE `tmp_transportrefs`;
