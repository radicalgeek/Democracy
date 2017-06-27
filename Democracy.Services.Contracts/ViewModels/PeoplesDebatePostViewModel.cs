using System;
using System.ComponentModel.DataAnnotations;
using Democracy.Data.DataModels;
using Democracy.Models;

namespace Democracy.Services.Contracts.ViewModels
{
    public class PeoplesDebatePostViewModel
    {
        [Key]
        public int Id { get; set; }

        public int BillId { get; set; }

        [MaxLength]
        //[AllowHtml]
        public string Text { get; set; }

        public virtual ApplicationUser Author { get; set; }
        public DateTime Date { get; set; }

        public PeoplesDebatePostViewModel MapFromDataObject(PeoplesDebatPostDataModel model)
        {
            Id = model.Id;
            BillId = model.BillDataModelId;
            Text = model.Text;
            Author = model.Author;
            Date = model.Date;
            return this;
        }
    }
}