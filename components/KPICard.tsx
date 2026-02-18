import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon: React.ReactNode;
  colorClass?: string;
}

const KPICard: React.FC<KPICardProps> = ({ 
  title, 
  value, 
  subValue, 
  trend, 
  trendValue, 
  icon,
  colorClass = "bg-blue-50 text-blue-600"
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col justify-between hover:shadow-md transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-medium text-gold-600 dark:text-gold-400">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</h3>
        </div>
        <div className={`p-3 rounded-lg ${colorClass}`}>
          {icon}
        </div>
      </div>
      
      {(subValue || trend) && (
        <div className="flex items-center text-sm">
          {trend === 'up' && <ArrowUpRight className="w-4 h-4 text-green-500 mr-1" />}
          {trend === 'down' && <ArrowDownRight className="w-4 h-4 text-red-500 mr-1" />}
          {trend === 'neutral' && <Minus className="w-4 h-4 text-gray-400 mr-1" />}
          
          <span className={`font-medium ${
            trend === 'up' ? 'text-green-600 dark:text-green-400' : 
            trend === 'down' ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
          }`}>
            {trendValue}
          </span>
          {subValue && <span className="text-gray-400 dark:text-gray-500 ml-2">{subValue}</span>}
        </div>
      )}
    </div>
  );
};

export default KPICard;