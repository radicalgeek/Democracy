using System;
using System.Collections.Generic;
using System.Data.Entity;
using System.Linq;
using Democracy.Bills.Models;
using Democracy.Data.DataModels;
using Democracy.Services.Contracts.ViewModels;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Moq;

namespace Democracy.Bills.Tests.Unit
{
    [TestClass]
    public class BillsServiceTests
    {
        [TestMethod]
        public void GetBillsReturnsListOfBills()
        {
            var data = SetupExpectedBillDataModels();
            var dbSetMock = SetupMockDbSet(data);
            var dbContextMock = SetupMockDbContext(dbSetMock);
            var stubDataRepository = new StubDataRepository(dbContextMock.Object);
            var rssClientMock = new Mock<IRssClient>();
            var billsService = new BillsService(stubDataRepository, rssClientMock.Object);

            List<BillViewModel> result = billsService.GetAllBills();

            Assert.IsTrue(result.Count == 2);
        }

        [TestMethod]
        public void UpdateBillDataPopulatesDatabaseWhenEmpty()
        {
            var data = new List<BillDataModel>().AsQueryable();
            var dbSetMock = SetupMockDbSet(data);
            var dbContextMock = SetupMockDbContext(dbSetMock);
            var stubDataRepository = new StubDataRepository(dbContextMock.Object);
            var rssClientMock = new Mock<IRssClient>();
            rssClientMock.Setup(x => x.GetBills(It.IsAny<string>())).Returns(SetupExpectedBillDataModels().ToList);
            
            var billsService = new BillsService(stubDataRepository, rssClientMock.Object);

            //billsService.UpdateBillData();
            dbContextMock.Verify(x => x.Set<BillDataModel>());

        }


        //[TestMethod]
        //public void GetDebates()
        //{
        //    var data = SetupExpectedBillDataModels();
        //    var dbSetMock = SetupMockDbSet(data);
        //    var dbContextMock = SetupMockDbContext(dbSetMock);
        //    var stubDataRepository = new StubDataRepository(dbContextMock.Object);
        //    var rssClientMock = new Mock<IRssClient>();
        //    rssClientMock.Setup(x => x.GetBills(It.IsAny<string>())).Returns(SetupExpectedBillDataModels().ToList);

        //    var billsService = new BillsService(stubDataRepository, rssClientMock.Object);

        //    billsService..PopulateParliamentaryDebatesForBill(205);
        //    dbContextMock.Verify(x => x.Set<BillDataModel>());
        //    Assert.IsTrue(true);
        //}

        private static Mock<IFakeDbContext> SetupMockDbContext(Mock<DbSet<BillDataModel>> dbSetMock)
        {
            var dbContextMock = new Mock<IFakeDbContext>();
            dbContextMock.Setup(x => x.Set<BillDataModel>()).Returns(dbSetMock.Object).Verifiable();
            return dbContextMock;
        }

        private static Mock<DbSet<BillDataModel>> SetupMockDbSet(IQueryable<BillDataModel> data)
        {
            var dbSetMock = new Mock<DbSet<BillDataModel>>();
            dbSetMock.As<IQueryable<BillDataModel>>().Setup(m => m.Provider).Returns(data.Provider);
            dbSetMock.As<IQueryable<BillDataModel>>().Setup(m => m.Expression).Returns(data.Expression);
            dbSetMock.As<IQueryable<BillDataModel>>().Setup(m => m.ElementType).Returns(data.ElementType);
            dbSetMock.As<IQueryable<BillDataModel>>().Setup(m => m.GetEnumerator()).Returns(data.GetEnumerator());
            return dbSetMock;
        }

        private static IQueryable<BillDataModel> SetupExpectedBillDataModels()
        {
            var data = new List<BillDataModel>
            {
                new BillDataModel()
                {
                    BillType = "string",
                    Description = "string",
                    House = "Lords",
                    Id = 205,
                    Stage = "string",
                    Title = "Childcare Payments Act 2014",
                    UpdatedDate = new DateTime(2015, 04, 21),
                    Url = "string"
                },
                new BillDataModel()
                {
                    BillType = "string",
                    Description = "string",
                    House = "Lords",
                    Id = 2,
                    Stage = "string",
                    Title = "string",
                    UpdatedDate = new DateTime(2015, 04, 21),
                    Url = "string"
                }
            }.AsQueryable();
            return data;
        }

    }
}
