using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Data.Migrations
{
    /// <inheritdoc />
    public partial class MIG_Fix_and_AddNewField_14040819 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "BirthDate",
                table: "Students",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EntryDate",
                table: "Students",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<byte>(
                name: "PaymentStatus",
                table: "Students",
                type: "tinyint",
                nullable: false,
                defaultValue: (byte)0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BirthDate",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "EntryDate",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "PaymentStatus",
                table: "Students");
        }
    }
}
