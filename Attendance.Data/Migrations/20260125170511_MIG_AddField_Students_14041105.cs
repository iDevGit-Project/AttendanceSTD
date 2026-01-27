using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Data.Migrations
{
    /// <inheritdoc />
    public partial class MIG_AddField_Students_14041105 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FatherJob",
                table: "Students",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FatherPhone",
                table: "Students",
                type: "nvarchar(15)",
                maxLength: 15,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HomeAddress",
                table: "Students",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsParentInEitaa",
                table: "Students",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "LastAverageDescription",
                table: "Students",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LastAverageScore",
                table: "Students",
                type: "decimal(4,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MotherJob",
                table: "Students",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MotherPhone",
                table: "Students",
                type: "nvarchar(15)",
                maxLength: 15,
                nullable: true);

            migrationBuilder.AddColumn<byte>(
                name: "OwnershipStatus",
                table: "Students",
                type: "tinyint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StudentPhone",
                table: "Students",
                type: "nvarchar(15)",
                maxLength: 15,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FatherJob",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "FatherPhone",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "HomeAddress",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "IsParentInEitaa",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "LastAverageDescription",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "LastAverageScore",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "MotherJob",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "MotherPhone",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "OwnershipStatus",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "StudentPhone",
                table: "Students");
        }
    }
}
