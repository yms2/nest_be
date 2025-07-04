import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, WhereExpressionBuilder } from 'typeorm';
import { BusinessInfo } from '../entities/business-info.entity';
import { DateFormatter } from '../utils/date-formatter.util';

@Injectable()
export class BusinessInfoSearchService {
  private readonly validFields = [
    'businessName',
    'businessNumber',
    'businessType',
    'businessCeo',
    'businessItem',
    'corporateRegistrationNumber',
    'businessTel',
    'businessMobile',
    'businessCeoEmail',
    'businessFax',
    'businessZipcode',
    'businessAddress',
    'businessAddressDetail',
    'createdAt',
    'updatedAt',
  ];

  private readonly datePattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/;

  constructor(
    @InjectRepository(BusinessInfo)
    private readonly businessInfoRepository: Repository<BusinessInfo>,
  ) {}

  // 통합검색 - 가장 많이 사용되는 검색
  async search(keyword: string, page: number = 1, limit: number = 10): Promise<SearchResult> {
    const trimmedKeyword = keyword.trim();
    const offset = (page - 1) * limit;

    const queryBuilder = this.businessInfoRepository
      .createQueryBuilder('business')
      .where('business.isDeleted = false')
      .andWhere(
        new Brackets(qb => {
          this.addTextSearchConditions(qb, trimmedKeyword);
          if (this.isDateSearch(trimmedKeyword)) {
            this.addDateSearchConditions(qb, trimmedKeyword);
          }
        }),
      )
      .orderBy('business.businessName', 'ASC')
      .skip(offset)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data: DateFormatter.formatBusinessInfoArrayDates(data),
      total,
      page,
      limit,
    };
  }

  // 날짜 범위 검색
  async searchByDateRange(
    startDate: string,
    endDate: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<SearchResult> {
    this.validateDateRange(startDate, endDate);

    const offset = (page - 1) * limit;
    const queryBuilder = this.businessInfoRepository
      .createQueryBuilder('business')
      .where('business.isDeleted = false')
      .andWhere('business.createdAt >= :startDate', {
        startDate: new Date(startDate).toISOString(),
      })
      .andWhere('business.createdAt <= :endDate', { endDate: new Date(endDate).toISOString() })
      .orderBy('business.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data: DateFormatter.formatBusinessInfoArrayDates(data),
      total,
      page,
      limit,
    };
  }

  private addTextSearchConditions(qb: WhereExpressionBuilder, keyword: string): void {
    this.validFields.forEach(field => {
      qb.orWhere(`business.${field} LIKE :keyword`, { keyword: `%${keyword}%` });
    });
  }

  private addDateSearchConditions(qb: WhereExpressionBuilder, keyword: string): void {
    const searchDate = new Date(keyword);
    qb.orWhere('DATE(business.createdAt) = DATE(:searchDate)', { searchDate }).orWhere(
      'DATE(business.updatedAt) = DATE(:searchDate)',
      { searchDate },
    );
  }

  private isDateSearch(keyword: string): boolean {
    return this.datePattern.test(keyword);
  }

  private validateDateRange(startDate: string, endDate: string): void {
    if (!this.datePattern.test(startDate) || !this.datePattern.test(endDate)) {
      throw new BadRequestException('날짜 형식이 올바르지 않습니다. (YYYY-MM-DD 또는 YYYY/MM/DD)');
    }
  }
}

interface SearchResult {
  data: BusinessInfo[];
  total: number;
  page: number;
  limit: number;
}
