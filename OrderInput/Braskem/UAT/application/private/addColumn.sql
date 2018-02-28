/* 20180227 */

ALTER TABLE `entries` RENAME TO `tmp_entries`;

/* Create the new table with the missing columns */

CREATE TABLE IF NOT EXISTS `entries` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `requestno` INTEGER, `custcode` VARCHAR(255), `opcode` VARCHAR(255), `costcenter` VARCHAR(255), `extid` VARCHAR(255), `eta` VARCHAR(255), `arrived` VARCHAR(255), `vessel` VARCHAR(255), `voyage` VARCHAR(255), `billoflading` VARCHAR(255), `quay` VARCHAR(255), `lloyd` VARCHAR(255), `pickup` VARCHAR(255), `shipno` VARCHAR(255), `agentcode` VARCHAR(255), `dispatchcountry` VARCHAR(255), `warehouse` VARCHAR(255), `tabledata` VARCHAR(255), `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL)

-- And populate it with the old data:

INSERT INTO `entries` (`id`, `requestno`, `custcode`, `opcode`, `costcenter`, `extid`, `eta`, `arrived`, `vessel`, `voyage`, `billoflading`, `quay`, `lloyd`, `pickup`, `shipno`, `agentcode`, `warehouse`, `tabledata`, `createdAt`, `updatedAt`) SELECT `id`, `requestno`, `custcode`, `opcode`, `costcenter`, `extid`, `eta`, `arrived`, `vessel`, `voyage`, `billoflading`, `quay`, `lloyd`, `pickup`, `shipno`, `agentcode`, `warehouse`, `tabledata`, `createdAt`, `updatedAt` FROM tmp_entries;

-- delete temp table
DROP TABLE `tmp_entries`;

/* 20170920 */

ALTER TABLE `entries` RENAME TO `tmp_entries`;

/* Create the new table with the missing columns */

CREATE TABLE IF NOT EXISTS `entries` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `custcode` VARCHAR(255), `extid` VARCHAR(255), `requestno` INTEGER, `costcenter` VARCHAR(255), `opcode` VARCHAR(255), `planneddate` VARCHAR(255), `invoicenumber` VARCHAR(255), `invoicedate` VARCHAR(255), `invoicevalue` VARCHAR(255), `invoicecurrency` VARCHAR(255), `invoicefob` VARCHAR(255), `invoicefrc` VARCHAR(255), `invoiceinsurance` VARCHAR(255), `invoicecif` VARCHAR(255), `invoicefrom` VARCHAR(255), `invoicetotal` VARCHAR(255), `customsdocnr` VARCHAR(255), `tabledata` VARCHAR(255), `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL);

-- And populate it with the old data:

INSERT INTO `entries` (`id`, `custcode`, `extid`, `requestno`, `costcenter`, `opcode`, `planneddate`, `invoicenumber`, `invoicedate`, `invoicevalue`, `invoicecurrency`, `invoicefob`, `invoicefrc`, `invoiceinsurance`, `invoicecif`, `invoicefrom`, `invoicetotal`, `customsdocnr`, `tabledata`, `createdAt`, `updatedAt`) SELECT `id`, `custcode`, `extid`, `requestno`, `costcenter`, `opcode`, `planneddate`, `invoicenumber`, `invoicedate`, `invoicevalue`, `invoicecurrency`, `invoicefob`, `invoicefrc`, `invoiceinsurance`, `invoicecif`, '', '', `customsdocnr`, `tabledata`, `createdAt`, `updatedAt` FROM tmp_entries;

-- delete temp table
DROP TABLE `tmp_entries`;

/* older */

ALTER TABLE `entries` RENAME TO `tmp_entries`;

/* Create the new table with the missing columns */

CREATE TABLE IF NOT EXISTS `entries` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `custcode` VARCHAR(255), `extid` VARCHAR(255), `requestno` INTEGER, `costcenter` VARCHAR(255), `opcode` VARCHAR(255), `planneddate` VARCHAR(255), `invoicenumber` VARCHAR(255), `invoicedate` VARCHAR(255), `invoicevalue` VARCHAR(255), `invoicecurrency` VARCHAR(255), `invoicefob` VARCHAR(255), `invoicefrc` VARCHAR(255), `invoiceinsurance` VARCHAR(255), `invoicecif` VARCHAR(255), `customsdocnr` VARCHAR(255), `tabledata` VARCHAR(255), `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL);

-- And populate it with the old data:

INSERT INTO `entries` (`id`, `custcode`, `extid`, `requestno`, `costcenter`, `opcode`, `planneddate`, `invoicenumber`, `invoicedate`, `invoicevalue`, `invoicecurrency`, `invoicefob`, `invoicefrc`, `invoiceinsurance`, `invoicecif`, `customsdocnr`, `tabledata`, `createdAt`, `updatedAt`) SELECT `id`, `custcode`, `extid`, `requestno`, `costcenter`, `opcode`, `planneddate`, '', '', '', 'EUR', '', '', '', '', '', `tabledata`, `createdAt`, `updatedAt` FROM tmp_entries;

-- delete temp table
DROP TABLE `tmp_entries`;
